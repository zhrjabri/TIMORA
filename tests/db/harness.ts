import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

export type TestDb = {
  db: PGlite;
  createUser: (meta?: Record<string, unknown>) => Promise<string>;
  /** Runs `fn` with RLS enforced as the given user (or as anon when uid is null). */
  as: <T>(uid: string | null, fn: () => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(await readFile(join(process.cwd(), "tests", "support", "supabase-bootstrap.sql"), "utf8"));

  const dir = join(process.cwd(), "supabase", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(join(dir, file), "utf8"));
  }

  let counter = 0;
  return {
    db,
    async createUser(meta = {}) {
      counter += 1;
      const res = await db.query<{ id: string }>(
        "insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), $1, $2) returning id",
        [`user${counter}@example.test`, JSON.stringify(meta)],
      );
      return res.rows[0]!.id;
    },
    async as(uid, fn) {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
      await db.exec(uid ? "set role authenticated" : "set role anon");
      try {
        return await fn();
      } finally {
        await db.exec("reset role");
        await db.query("select set_config('request.jwt.claim.sub', '', false)");
      }
    },
    close: () => db.close(),
  };
}
