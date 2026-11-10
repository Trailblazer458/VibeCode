// Database access. Uses Supabase Postgres when DATABASE_URL is set; otherwise an embedded Postgres (PGlite)
// so the prototype runs with zero setup. Schema and seed are applied automatically on first use.
import { SCHEMA_SQL } from "./schema";

type Row = Record<string, unknown>;
interface Driver {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
}

/**
 * Callers pass JSON parameters already stringified (`$1::jsonb` with JSON.stringify(v)). postgres.js sees a
 * json-typed parameter and JSON-encodes the string again, so Postgres receives a JSON *string*
 * ("cannot call json_populate_recordset on a scalar"). Casting through text makes postgres.js send it as-is.
 */
export function castJsonParamsViaText(text: string) {
  return text.replace(/(\$\d+)::(jsonb?)\b/g, "$1::text::$2");
}

let driverPromise: Promise<Driver> | null = null;
let readyPromise: Promise<void> | null = null;

async function makeDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(url, {
      prepare: false, // required for Supabase's transaction pooler (port 6543)
      ssl: url.includes("localhost") ? false : "require",
      max: 3,
      // No pipelining: parallel queries (Promise.all) would send several unnamed statements down one
      // connection, which the transaction pooler mixes up (hangs / "bind message supplies N parameters").
      max_pipeline: 1,
      idle_timeout: 20,
      onnotice: () => {},
    });
    return {
      async query<T>(text: string, params: unknown[] = []) {
        return (await sql.unsafe(castJsonParamsViaText(text), params as never[])) as unknown as T[];
      },
      async exec(text: string) {
        await sql.unsafe(text);
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.VERCEL ? "memory://" : process.env.PGLITE_DIR || "./.pglite";
  const db = await PGlite.create(dir);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const r = await db.query(text, params);
      return r.rows as T[];
    },
    async exec(text: string) {
      await db.exec(text);
    },
  };
}

export function driver() {
  const g = globalThis as unknown as { __tgDriver?: Promise<Driver> };
  if (!g.__tgDriver) g.__tgDriver = makeDriver();
  driverPromise = g.__tgDriver;
  return driverPromise;
}

export async function ensureReady() {
  const g = globalThis as unknown as { __tgReady?: Promise<void> };
  if (!g.__tgReady) {
    g.__tgReady = (async () => {
      const d = await driver();
      await d.exec(SCHEMA_SQL);
      const rows = await d.query<{ n: number }>("select count(*)::int as n from profiles where id = 'arjun'");
      if (!rows[0] || rows[0].n === 0) {
        const { seedAll } = await import("./seed");
        await seedAll(d);
      }
    })().catch((e) => {
      g.__tgReady = undefined;
      throw e;
    });
  }
  readyPromise = g.__tgReady;
  return readyPromise;
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureReady();
  const d = await driver();
  return d.query<T>(text, params);
}

export async function one<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const r = await q<T>(text, params);
  return r[0] ?? null;
}

/** Bulk insert via json_populate_recordset: one round trip, works on Postgres and PGlite. */
export async function bulkInsert(d: Driver, table: string, rows: object[]) {
  if (!rows.length) return;
  const chunk = 400;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const cols = Object.keys(part[0] as Row);
    await d.query(
      `insert into ${table} (${cols.join(",")}) select ${cols.join(",")} from json_populate_recordset(null::${table}, $1::json) on conflict do nothing`,
      [JSON.stringify(part)],
    );
  }
}

export type { Driver };
