// Local Supabase stand-in for end-to-end tests and UI review without Docker.
//
// It implements the small subset of the Auth (GoTrue) and REST (PostgREST) HTTP APIs
// that TIMORA uses, backed by PGlite running the real migrations. Every REST request
// executes as `anon` or `authenticated` with auth.uid() set, so Row-Level Security,
// column grants, constraints and triggers are enforced exactly as written in SQL.
//
// It is NOT a production server and is never deployed. Final verification must still
// run against a real Supabase project.
//
// Usage: node tests/support/fake-supabase.mjs [port]
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const PORT = Number(process.argv[2] ?? process.env.FAKE_SUPABASE_PORT ?? 54321);
const ROOT = process.cwd();
const SECRET = randomBytes(32);

// Keep dates and timestamps as PostgREST-style strings instead of JS Date objects.
const TEXT_TYPES = { 1082: (v) => v, 1114: (v) => v, 1184: (v) => v };
const db = new PGlite({ parsers: TEXT_TYPES });
await db.exec(await readFile(join(ROOT, "tests", "support", "supabase-bootstrap.sql"), "utf8"));
const migrations = (await readdir(join(ROOT, "supabase", "migrations"))).filter((f) => f.endsWith(".sql")).sort();
for (const file of migrations) await db.exec(await readFile(join(ROOT, "supabase", "migrations", file), "utf8"));

/** Serialises all database work: PGlite is a single connection and role/claims are session state. */
let queue = Promise.resolve();
function exclusive(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

// ── Auth ────────────────────────────────────────────────────────────────────
const credentials = new Map(); // email -> { id, hash, salt, meta, createdAt }
const refreshTokens = new Map(); // token -> user id

const b64url = (buf) => Buffer.from(buf).toString("base64url");
function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [header, body, sig] = String(token ?? "").split(".");
  if (!header || !body || !sig) return null;
  const expected = b64url(createHmac("sha256", SECRET).update(`${header}.${body}`).digest());
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp * 1000 < Date.now()) return null;
  return payload;
}

function userById(id) {
  for (const [email, rec] of credentials) if (rec.id === id) return { email, ...rec };
  return null;
}

function publicUser(email, rec) {
  return {
    id: rec.id,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: rec.createdAt,
    confirmed_at: rec.createdAt,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: rec.meta,
    identities: [{ id: rec.id, user_id: rec.id, provider: "email", identity_data: { email, sub: rec.id } }],
    created_at: rec.createdAt,
    updated_at: rec.createdAt,
  };
}

function session(email, rec) {
  const now = Math.floor(Date.now() / 1000);
  const access = signJwt({ sub: rec.id, email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600, session_id: randomUUID() });
  const refresh = b64url(randomBytes(24));
  refreshTokens.set(refresh, rec.id);
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user: publicUser(email, rec) };
}

const hashPassword = (password, salt) => scryptSync(password, salt, 32).toString("hex");

function authError(res, status, code, message) {
  send(res, status, { code: status, error_code: code, msg: message, message });
}

async function handleAuth(req, res, url, body) {
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  if (req.method === "POST" && path === "/signup") {
    const email = String(body.email ?? "").toLowerCase();
    if (!email || String(body.password ?? "").length < 8) return authError(res, 422, "weak_password", "Password should be at least 8 characters.");
    if (credentials.has(email)) return authError(res, 422, "user_already_exists", "User already registered");
    const id = randomUUID();
    const salt = randomBytes(16).toString("hex");
    const rec = { id, salt, hash: hashPassword(body.password, salt), meta: body.data ?? {}, createdAt: new Date().toISOString() };
    await exclusive(() => db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, email, JSON.stringify(rec.meta)]));
    credentials.set(email, rec);
    return send(res, 200, session(email, rec));
  }
  if (req.method === "POST" && path === "/token") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const email = String(body.email ?? "").toLowerCase();
      const rec = credentials.get(email);
      if (!rec || hashPassword(String(body.password ?? ""), rec.salt) !== rec.hash) return authError(res, 400, "invalid_credentials", "Invalid login credentials");
      return send(res, 200, session(email, rec));
    }
    if (grant === "refresh_token") {
      const id = refreshTokens.get(body.refresh_token);
      const user = id ? userById(id) : null;
      if (!user) return authError(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      refreshTokens.delete(body.refresh_token);
      return send(res, 200, session(user.email, user));
    }
  }
  const claims = verifyJwt((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
  const user = claims ? userById(claims.sub) : null;
  if (path === "/user" && req.method === "GET") {
    if (!user) return authError(res, 403, "bad_jwt", "invalid JWT");
    return send(res, 200, publicUser(user.email, user));
  }
  if (path === "/user" && req.method === "PUT") {
    if (!user) return authError(res, 401, "session_not_found", "Auth session missing!");
    if (body.password) {
      if (String(body.password).length < 8) return authError(res, 422, "weak_password", "Password should be at least 8 characters.");
      const rec = credentials.get(user.email);
      rec.hash = hashPassword(body.password, rec.salt);
    }
    return send(res, 200, publicUser(user.email, credentials.get(user.email)));
  }
  if (path === "/logout") return send(res, 204, null);
  if (path === "/recover") return send(res, 200, {});
  return authError(res, 404, "not_found", "Not found");
}

// ── REST ────────────────────────────────────────────────────────────────────
const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (name) => {
  if (!IDENT.test(name)) throw Object.assign(new Error(`invalid identifier ${name}`), { code: "PGRST100", status: 400 });
  return `"${name}"`;
};

function normaliseValue(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}(:\d{2})?$/.test(value)) {
    return value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  }
  return value;
}
const normaliseRow = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, normaliseValue(v)]));

function buildWhere(params, values) {
  const clauses = [];
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(key)) continue;
    const dot = raw.indexOf(".");
    const op = raw.slice(0, dot);
    const val = raw.slice(dot + 1);
    const col = ident(key);
    const ops = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };
    if (op === "is") {
      const map = { null: "null", true: "true", false: "false" };
      if (!map[val]) throw Object.assign(new Error("bad is"), { code: "PGRST100", status: 400 });
      clauses.push(`${col} is ${map[val]}`);
    } else if (op === "in") {
      const items = val.replace(/^\(|\)$/g, "").split(",").filter(Boolean);
      const placeholders = items.map((item) => {
        values.push(item.replace(/^"|"$/g, ""));
        return `$${values.length}`;
      });
      clauses.push(placeholders.length ? `${col} in (${placeholders.join(",")})` : "false");
    } else if (ops[op]) {
      values.push(val);
      clauses.push(`${col} ${ops[op]} $${values.length}`);
    } else {
      throw Object.assign(new Error(`unsupported operator ${op}`), { code: "PGRST100", status: 400 });
    }
  }
  return clauses.length ? ` where ${clauses.join(" and ")}` : "";
}

function selectList(params) {
  const select = params.get("select") ?? "*";
  if (select === "*") return "*";
  return select.split(",").map((c) => ident(c.trim())).join(", ");
}

function orderClause(params) {
  const order = params.get("order");
  if (!order) return "";
  return ` order by ${order
    .split(",")
    .map((part) => {
      const [col, dir = "asc", nulls] = part.split(".");
      const direction = dir === "desc" ? "desc" : "asc";
      const nullsSql = nulls === "nullsfirst" ? " nulls first" : nulls === "nullslast" ? " nulls last" : "";
      return `${ident(col)} ${direction}${nullsSql}`;
    })
    .join(", ")}`;
}

function pgErrorResponse(res, error, role) {
  const code = error.code ?? "";
  let status = error.status ?? 400;
  if (code === "42501") status = role === "anon" ? 401 : 403;
  else if (code === "23505" || code === "23503") status = 409;
  else if (code === "P0002") status = 404;
  send(res, status, { code, message: error.message, details: error.detail ?? null, hint: error.hint ?? null });
}

async function handleRest(req, res, url, body) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const claims = verifyJwt(token);
  const role = claims ? "authenticated" : "anon";
  const uid = claims?.sub ?? "";
  const path = url.pathname.replace(/^\/rest\/v1\//, "");
  const params = url.searchParams;
  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object+json");
  const returnRepresentation = (req.headers.prefer ?? "").includes("return=representation");

  try {
    const result = await exclusive(async () => {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
      await db.exec(`set role ${role}`);
      try {
        const values = [];
        if (path.startsWith("rpc/")) {
          const fn = ident(path.slice(4));
          const args = Object.entries(body ?? {}).map(([k, v]) => {
            values.push(v);
            return `${ident(k)} => $${values.length}`;
          });
          const r = await db.query(`select public.${fn}(${args.join(", ")}) as result`, values);
          return { scalar: r.rows[0]?.result ?? null };
        }
        const table = `public.${ident(path)}`;
        if (req.method === "GET") {
          const limit = params.get("limit") ? ` limit ${Number(params.get("limit"))}` : "";
          const offset = params.get("offset") ? ` offset ${Number(params.get("offset"))}` : "";
          const r = await db.query(`select ${selectList(params)} from ${table}${buildWhere(params, values)}${orderClause(params)}${limit}${offset}`, values);
          return { rows: r.rows };
        }
        const returning = returnRepresentation ? ` returning ${selectList(params)}` : "";
        if (req.method === "POST") {
          const rows = Array.isArray(body) ? body : [body];
          const out = [];
          for (const row of rows) {
            const cols = Object.keys(row);
            const vals = cols.map((c) => row[c]);
            const r = await db.query(
              `insert into ${table} (${cols.map(ident).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})${returning}`,
              vals,
            );
            out.push(...r.rows);
          }
          return { rows: out, created: true };
        }
        if (req.method === "PATCH") {
          const cols = Object.keys(body ?? {});
          const sets = cols.map((c) => {
            values.push(body[c]);
            return `${ident(c)} = $${values.length}`;
          });
          const r = await db.query(`update ${table} set ${sets.join(", ")}${buildWhere(params, values)}${returning}`, values);
          return { rows: r.rows };
        }
        if (req.method === "DELETE") {
          const r = await db.query(`delete from ${table}${buildWhere(params, values)}${returning}`, values);
          return { rows: r.rows };
        }
        throw Object.assign(new Error("method not allowed"), { status: 405 });
      } finally {
        await db.exec("reset role");
      }
    });

    if ("scalar" in result) return send(res, 200, normaliseValue(result.scalar));
    const rows = result.rows.map(normaliseRow);
    if (wantsObject) {
      if (rows.length !== 1) {
        return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows`, hint: null });
      }
      return send(res, result.created ? 201 : 200, rows[0]);
    }
    if (!returnRepresentation && req.method !== "GET") return send(res, result.created ? 201 : 204, null);
    return send(res, result.created ? 201 : 200, rows);
  } catch (error) {
    return pgErrorResponse(res, error, role);
  }
}

// ── HTTP ────────────────────────────────────────────────────────────────────
function send(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "content-range, x-supabase-api-version",
  });
  res.end(payload === null || status === 204 ? "" : JSON.stringify(payload));
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] ?? "*",
      "Access-Control-Max-Age": "600",
    });
    return res.end();
  }
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  let body = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf8");
    body = text ? JSON.parse(text) : null;
  }
  try {
    if (url.pathname === "/health") return send(res, 200, { ok: true });
    if (url.pathname.startsWith("/auth/v1/")) return await handleAuth(req, res, url, body ?? {});
    if (url.pathname.startsWith("/rest/v1/")) return await handleRest(req, res, url, body);
    return send(res, 404, { message: "not found" });
  } catch (error) {
    return send(res, 500, { message: String(error?.message ?? error) });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`fake-supabase listening on http://127.0.0.1:${PORT}`);
});
