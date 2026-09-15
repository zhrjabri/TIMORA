import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let t: TestDb;
let alice: string;
let bob: string;
let aliceItem: string;
let aliceToken: string;
let aliceCategory: string;
let aliceCompletion: string;

async function rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await t.db.query<T>(sql, params);
  return res.rows;
}

async function expectError(promise: Promise<unknown>, pattern: RegExp) {
  await expect(promise).rejects.toThrow(pattern);
}

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser({ locale: "en", timezone: "Asia/Riyadh" });
  bob = await t.createUser({ locale: "xx", timezone: "Not/AZone" });

  await t.as(alice, async () => {
    const [cat] = await rows<{ id: string }>("select id from public.categories where system_key = 'home'");
    aliceCategory = cat!.id;
    const [item] = await rows<{ id: string; qr_token: string }>(
      `insert into public.items (name, category_id, schedule_type, interval_count, interval_unit)
       values ('Water filter', $1, 'interval', 3, 'month') returning id, qr_token`,
      [aliceCategory],
    );
    aliceItem = item!.id;
    aliceToken = item!.qr_token;
    const [rec] = await rows<{ id: string }>(
      "insert into public.completion_records (item_id, completed_on, source) values ($1, current_date - 10, 'initial') returning id",
      [aliceItem],
    );
    aliceCompletion = rec!.id;
  });
});

afterAll(async () => {
  await t?.close();
});

describe("new user bootstrap", () => {
  it("creates a profile with validated preferences", async () => {
    const [a] = await t.as(alice, () => rows<{ locale: string; timezone: string; theme: string }>("select locale, timezone, theme from public.profiles"));
    expect(a).toEqual({ locale: "en", timezone: "Asia/Riyadh", theme: "system" });
    const [b] = await t.as(bob, () => rows<{ locale: string; timezone: string }>("select locale, timezone from public.profiles"));
    expect(b).toEqual({ locale: "ar", timezone: "UTC" });
  });

  it("seeds the nine starter categories", async () => {
    const cats = await t.as(bob, () => rows<{ system_key: string }>("select system_key from public.categories order by system_key"));
    expect(cats.map((c) => c.system_key)).toEqual([
      "documents", "health", "home", "lent_items", "other", "personal_care", "pets", "plants", "vehicle",
    ]);
  });
});

describe("cross-user isolation", () => {
  it("hides every private row from another user", async () => {
    await t.as(bob, async () => {
      expect(await rows("select * from public.items where id = $1", [aliceItem])).toHaveLength(0);
      expect(await rows("select * from public.item_overview where id = $1", [aliceItem])).toHaveLength(0);
      expect(await rows("select * from public.completion_records where item_id = $1", [aliceItem])).toHaveLength(0);
      expect(await rows("select * from public.categories where id = $1", [aliceCategory])).toHaveLength(0);
      expect(await rows("select * from public.profiles where id = $1", [alice])).toHaveLength(0);
    });
  });

  it("does not resolve another user's QR token", async () => {
    const found = await t.as(bob, () => rows("select id from public.items where qr_token = $1", [aliceToken]));
    expect(found).toHaveLength(0);
  });

  it("prevents updating or deleting another user's rows", async () => {
    await t.as(bob, async () => {
      const upd = await t.db.query("update public.items set name = 'hacked' where id = $1", [aliceItem]);
      expect(upd.affectedRows).toBe(0);
      const del = await t.db.query("delete from public.items where id = $1", [aliceItem]);
      expect(del.affectedRows).toBe(0);
      const cat = await t.db.query("update public.categories set name = 'hacked' where id = $1", [aliceCategory]);
      expect(cat.affectedRows).toBe(0);
      const prof = await t.db.query("update public.profiles set theme = 'dark' where id = $1", [alice]);
      expect(prof.affectedRows).toBe(0);
      const undo = await t.db.query("update public.completion_records set undone_at = now() where id = $1", [aliceCompletion]);
      expect(undo.affectedRows).toBe(0);
    });
    const [item] = await t.as(alice, () => rows<{ name: string }>("select name from public.items where id = $1", [aliceItem]));
    expect(item!.name).toBe("Water filter");
  });

  it("prevents recording a completion on another user's item", async () => {
    await t.as(bob, () =>
      expectError(
        t.db.query("insert into public.completion_records (item_id, completed_on) values ($1, current_date)", [aliceItem]),
        /foreign key|violates/i,
      ),
    );
  });

  it("prevents attaching another user's category", async () => {
    await t.as(bob, () =>
      expectError(
        t.db.query(
          "insert into public.items (name, category_id, schedule_type) values ('Mine', $1, 'none')",
          [aliceCategory],
        ),
        /foreign key|violates/i,
      ),
    );
  });

  it("does not allow choosing the owner on insert", async () => {
    await t.as(bob, () =>
      expectError(
        t.db.query("insert into public.items (user_id, name, schedule_type) values ($1, 'Spoof', 'none')", [alice]),
        /permission denied/i,
      ),
    );
  });

  it("does not allow rotating another user's QR token", async () => {
    await t.as(bob, () => expectError(t.db.query("select public.regenerate_qr_token($1)", [aliceItem]), /not_found/));
  });

  it("blocks anonymous access entirely", async () => {
    await t.as(null, async () => {
      await expectError(t.db.query("select * from public.items"), /permission denied/i);
      await expectError(t.db.query("select * from public.item_overview"), /permission denied/i);
      await expectError(t.db.query("select * from public.completion_records"), /permission denied/i);
      await expectError(t.db.query("select * from public.profiles"), /permission denied/i);
      await expectError(t.db.query("select * from public.categories"), /permission denied/i);
      await expectError(t.db.query("select public.regenerate_qr_token($1)", [aliceItem]), /permission denied/i);
    });
  });
});

describe("column-level write protection", () => {
  it("rejects direct changes to protected item columns", async () => {
    await t.as(alice, async () => {
      await expectError(t.db.query("update public.items set qr_token = repeat('a', 64) where id = $1", [aliceItem]), /permission denied/i);
      await expectError(t.db.query("update public.items set user_id = $1 where id = $2", [bob, aliceItem]), /permission denied/i);
      await expectError(t.db.query("update public.items set schedule_set_at = now() where id = $1", [aliceItem]), /permission denied/i);
    });
  });

  it("keeps completion history append-only", async () => {
    await t.as(alice, async () => {
      await expectError(
        t.db.query("update public.completion_records set completed_on = current_date - 400 where id = $1", [aliceCompletion]),
        /permission denied/i,
      );
      await expectError(t.db.query("delete from public.completion_records where id = $1", [aliceCompletion]), /permission denied/i);
    });
  });

  it("does not let users set system category keys", async () => {
    await t.as(alice, () =>
      expectError(t.db.query("insert into public.categories (system_key) values ('home')"), /permission denied/i),
    );
  });
});

describe("constraints and triggers", () => {
  it("enforces a consistent schedule shape", async () => {
    await t.as(alice, async () => {
      await expectError(
        t.db.query("insert into public.items (name, schedule_type) values ('Bad', 'interval')"),
        /items_schedule_shape/,
      );
      await expectError(
        t.db.query("insert into public.items (name, schedule_type, due_date, interval_count, interval_unit) values ('Bad', 'once', current_date, 2, 'day')"),
        /items_schedule_shape/,
      );
      await expectError(
        t.db.query("insert into public.items (name, schedule_type, interval_count, interval_unit) values ('Bad', 'interval', 0, 'day')"),
        /check constraint/,
      );
      await expectError(t.db.query("insert into public.items (name, schedule_type) values ('  padded ', 'none')"), /check constraint/);
    });
  });

  it("generates unguessable 64-character QR tokens", async () => {
    expect(aliceToken).toMatch(/^[0-9a-f]{64}$/);
    const rotated = await t.as(alice, () => rows<{ token: string }>("select public.regenerate_qr_token($1) as token", [aliceItem]));
    expect(rotated[0]!.token).toMatch(/^[0-9a-f]{64}$/);
    expect(rotated[0]!.token).not.toBe(aliceToken);
  });

  it("rejects completions dated in the future", async () => {
    await t.as(alice, () =>
      expectError(
        t.db.query("insert into public.completion_records (item_id, completed_on, source) values ($1, current_date + 3, 'backdated')", [aliceItem]),
        /completion_in_future/,
      ),
    );
  });

  it("guards against double taps on Done now", async () => {
    await t.as(alice, async () => {
      await t.db.query("insert into public.completion_records (item_id, completed_on, source) values ($1, current_date, 'done_now')", [aliceItem]);
      await expectError(
        t.db.query("insert into public.completion_records (item_id, completed_on, source) values ($1, current_date, 'done_now')", [aliceItem]),
        /duplicate_completion/,
      );
    });
  });

  it("undo marks a record with a server time and cannot be reversed", async () => {
    await t.as(alice, async () => {
      const [rec] = await rows<{ id: string }>(
        "insert into public.completion_records (item_id, completed_on, source) values ($1, current_date - 1, 'backdated') returning id",
        [aliceItem],
      );
      const upd = await t.db.query("update public.completion_records set undone_at = '2000-01-01' where id = $1", [rec!.id]);
      expect(upd.affectedRows).toBe(1);
      const [after] = await rows<{ undone_at: Date }>("select undone_at from public.completion_records where id = $1", [rec!.id]);
      expect(new Date(after!.undone_at).getFullYear()).toBeGreaterThan(2000);
      await expectError(
        t.db.query("update public.completion_records set undone_at = null where id = $1", [rec!.id]),
        /already_undone/,
      );
    });
  });

  it("excludes undone completions from the overview", async () => {
    await t.as(alice, async () => {
      const [item] = await rows<{ id: string }>(
        "insert into public.items (name, schedule_type, interval_count, interval_unit) values ('Toothbrush', 'interval', 3, 'month') returning id",
      );
      const [rec] = await rows<{ id: string }>(
        "insert into public.completion_records (item_id, completed_on, source) values ($1, current_date - 5, 'backdated') returning id",
        [item!.id],
      );
      let [ov] = await rows<{ completion_count: number; last_completed_on: Date | null }>(
        "select completion_count, last_completed_on from public.item_overview where id = $1",
        [item!.id],
      );
      expect(ov!.completion_count).toBe(1);
      await t.db.query("update public.completion_records set undone_at = now() where id = $1", [rec!.id]);
      [ov] = await rows("select completion_count, last_completed_on from public.item_overview where id = $1", [item!.id]);
      expect(ov!.completion_count).toBe(0);
      expect(ov!.last_completed_on).toBeNull();
    });
  });

  it("ignores initial history when resolving one-time dates", async () => {
    await t.as(alice, async () => {
      const [item] = await rows<{ id: string }>(
        "insert into public.items (name, schedule_type, due_date) values ('Passport', 'once', current_date + 200) returning id",
      );
      await t.db.query("insert into public.completion_records (item_id, completed_on, source) values ($1, current_date - 3650, 'initial')", [item!.id]);
      let [ov] = await rows<{ latest_recorded_at: Date | null; last_completed_on: Date | null }>(
        "select latest_recorded_at, last_completed_on from public.item_overview where id = $1",
        [item!.id],
      );
      expect(ov!.latest_recorded_at).toBeNull();
      expect(ov!.last_completed_on).not.toBeNull();
      await t.db.query("insert into public.completion_records (item_id, completed_on, source) values ($1, current_date, 'done_now')", [item!.id]);
      [ov] = await rows("select latest_recorded_at, last_completed_on from public.item_overview where id = $1", [item!.id]);
      expect(ov!.latest_recorded_at).not.toBeNull();
    });
  });

  it("rejects completions on archived items", async () => {
    await t.as(alice, async () => {
      // archived_at is not insertable; items are archived through an update.
      await expectError(
        t.db.query("insert into public.items (name, schedule_type, archived_at) values ('Old', 'none', now())"),
        /permission denied/i,
      );
      const [item] = await rows<{ id: string }>("insert into public.items (name, schedule_type) values ('Old', 'none') returning id");
      await t.db.query("update public.items set archived_at = now() where id = $1", [item!.id]);
      await expectError(
        t.db.query("insert into public.completion_records (item_id, completed_on, source) values ($1, current_date, 'backdated')", [item!.id]),
        /item_archived/,
      );
    });
  });

  it("updates schedule_set_at only when the schedule changes", async () => {
    await t.as(alice, async () => {
      const [before] = await rows<{ schedule_set_at: Date }>("select schedule_set_at from public.items where id = $1", [aliceItem]);
      await new Promise((r) => setTimeout(r, 20));
      await t.db.query("update public.items set note = 'Under the sink' where id = $1", [aliceItem]);
      const [same] = await rows<{ schedule_set_at: Date }>("select schedule_set_at from public.items where id = $1", [aliceItem]);
      expect(new Date(same!.schedule_set_at).getTime()).toBe(new Date(before!.schedule_set_at).getTime());
      await t.db.query("update public.items set interval_count = 6 where id = $1", [aliceItem]);
      const [changed] = await rows<{ schedule_set_at: Date }>("select schedule_set_at from public.items where id = $1", [aliceItem]);
      expect(new Date(changed!.schedule_set_at).getTime()).toBeGreaterThan(new Date(before!.schedule_set_at).getTime());
    });
  });

  it("clears the category when a category is deleted and cascades history when an item is deleted", async () => {
    await t.as(alice, async () => {
      const [cat] = await rows<{ id: string }>("insert into public.categories (name, icon) values ('Garage', 'wrench') returning id");
      const [item] = await rows<{ id: string }>(
        "insert into public.items (name, category_id, schedule_type) values ('Tyres', $1, 'none') returning id",
        [cat!.id],
      );
      await t.db.query("insert into public.completion_records (item_id, completed_on, source) values ($1, current_date - 2, 'backdated')", [item!.id]);
      await t.db.query("delete from public.categories where id = $1", [cat!.id]);
      const [after] = await rows<{ category_id: string | null }>("select category_id from public.items where id = $1", [item!.id]);
      expect(after!.category_id).toBeNull();
      await t.db.query("delete from public.items where id = $1", [item!.id]);
      expect(await rows("select 1 from public.completion_records where item_id = $1", [item!.id])).toHaveLength(0);
    });
  });

  it("rejects duplicate custom category names regardless of case", async () => {
    await t.as(alice, async () => {
      await t.db.query("insert into public.categories (name) values ('Kitchen')");
      await expectError(t.db.query("insert into public.categories (name) values ('kitchen')"), /duplicate key/);
    });
  });

  it("validates profile timezones", async () => {
    await t.as(alice, () =>
      expectError(t.db.query("update public.profiles set timezone = 'Mars/Olympus' where id = $1", [alice]), /invalid_timezone/),
    );
  });
});
