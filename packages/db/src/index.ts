import {
  mkdir,
  readFile,
  writeFile,
  rename,
  stat,
  rmdir,
} from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { emptyState, type State, type Point } from "../../domain/src/index";
import {
  dataDir,
  demoEnabled,
  secret,
  databaseSsl,
} from "../../config/src/index";
import { demoSeed } from "./seed-data";
import { addDemoEvidence } from "./demo-evidence";
export interface Transaction {
  state: State;
  jurisdiction(point: Point): Promise<string | null>;
  duplicates(
    point: Point,
    radius: number,
    days: number,
  ): Promise<string[] | null>;
}
export interface Repository {
  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  health(): Promise<boolean>;
}
const locks = new Map<string, Promise<unknown>>();
async function fileLock(filename: string) {
  const lock = filename + ".lock";
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await mkdir(lock);
      return async () => {
        await rmdir(lock);
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - (await stat(lock)).mtimeMs > 120000) await rmdir(lock);
      } catch {
        /* Another process may already have released it. */
      }
      await delay(250);
    }
  }
  throw new Error("Demo repository busy. Retry shortly.");
}
export class DemoRepository implements Repository {
  constructor(private filename = path.join(dataDir(), "demo.json")) {}
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const previous = locks.get(this.filename) || Promise.resolve();
    const work = previous
      .catch(() => {})
      .then(async () => {
        await mkdir(path.dirname(this.filename), { recursive: true });
        const release = await fileLock(this.filename);
        try {
          let state: State;
          try {
            state = JSON.parse(await readFile(this.filename, "utf8")) as State;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            state = demoSeed(secret("AUDIT_HASH_SECRET"));
            await addDemoEvidence(state);
          }
          const result = await fn({
            state,
            jurisdiction: async (point) =>
              state.jurisdictions.find(
                (j) =>
                  point.lat >= j.minLat &&
                  point.lat <= j.maxLat &&
                  point.lng >= j.minLng &&
                  point.lng <= j.maxLng,
              )?.id || null,
            duplicates: async () => null,
          });
          const temp = this.filename + ".tmp";
          await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
          await rename(temp, this.filename);
          return result;
        } finally {
          await release();
        }
      });
    locks.set(this.filename, work);
    try {
      return await work;
    } finally {
      if (locks.get(this.filename) === work) locks.delete(this.filename);
    }
  }
  async health() {
    await this.transaction(async () => true);
    return true;
  }
}
const tables = {
  reports: "reports",
  locations: "report_locations_private",
  media: "report_media",
  events: "report_events",
  audits: "audit_logs",
  jurisdictions: "jurisdictions",
  profiles: "profiles",
  sessions: "app_sessions",
  requests: "data_subject_requests",
  jobs: "provider_jobs",
} as const;
type StateKey = keyof typeof tables;
export class PostgresRepository implements Repository {
  pool: Pool;
  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) throw new Error("DATABASE_URL required");
    this.pool = new Pool({
      connectionString,
      max: 8,
      ssl: databaseSsl(),
    });
  }
  async health() {
    await this.pool.query("SELECT PostGIS_Version()");
    return true;
  }
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(720061008)");
      const state = emptyState();
      for (const [key, table] of Object.entries(tables)) {
        const result = await client.query<{ data: unknown }>(
          `SELECT data FROM ${table}${key === "audits" || key === "events" ? " ORDER BY seq" : ""}`,
        );
        (state[key as StateKey] as unknown[]).push(
          ...result.rows.map((r) => r.data),
        );
      }
      const before = structuredClone(state);
      const result = await fn({
        state,
        jurisdiction: async (p) => {
          const res = await client.query<{ id: string }>(
            "SELECT id FROM jurisdictions WHERE ST_Covers(boundary, ST_SetSRID(ST_MakePoint($1,$2),4326)) ORDER BY id LIMIT 1",
            [p.lng, p.lat],
          );
          return res.rows[0]?.id || null;
        },
        duplicates: async (p, radius, days) => {
          const res = await client.query<{ report_id: string }>(
            "SELECT l.report_id FROM report_locations_private l JOIN reports r ON r.id=l.report_id WHERE ST_DWithin(l.exact_location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$3) AND r.created_at > now()-($4::int * interval '1 day') LIMIT 5",
            [p.lng, p.lat, radius, days],
          );
          return res.rows.map((r) => r.report_id);
        },
      });
      await this.persist(client, before, state);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  private async persist(client: PoolClient, before: State, state: State) {
    for (const [key, table] of Object.entries(tables)) {
      const k = key as StateKey;
      const old = before[k] as unknown as Record<string, unknown>[];
      const rows = state[k] as unknown as Record<string, unknown>[];
      const idKey =
        key === "locations" ? "reportId" : key === "sessions" ? "hash" : "id";
      for (const row of rows) {
        const existing = old.find((r) => r[idKey] === row[idKey]);
        if (existing && JSON.stringify(existing) === JSON.stringify(row))
          continue;
        const id = row[idKey];
        const json = JSON.stringify(row);
        if (key === "locations")
          await client.query(
            "INSERT INTO report_locations_private(report_id,data,exact_location) VALUES($1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326)::geography) ON CONFLICT(report_id) DO UPDATE SET data=$2,exact_location=EXCLUDED.exact_location",
            [id, json, row.lng, row.lat],
          );
        else if (key === "jurisdictions")
          await client.query(
            "INSERT INTO jurisdictions(id,data,boundary) VALUES($1,$2,ST_Multi(ST_MakeEnvelope($3,$4,$5,$6,4326))) ON CONFLICT(id) DO UPDATE SET data=$2,boundary=EXCLUDED.boundary",
            [id, json, row.minLng, row.minLat, row.maxLng, row.maxLat],
          );
        else if (key === "reports") {
          const p = row.publicLocation as Point;
          await client.query(
            "INSERT INTO reports(id,data,public_location,created_at) VALUES($1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326),$5) ON CONFLICT(id) DO UPDATE SET data=$2,public_location=EXCLUDED.public_location",
            [id, json, p.lng, p.lat, row.createdAt],
          );
        } else if (key === "audits" || key === "events")
          await client.query(`INSERT INTO ${table}(id,data) VALUES($1,$2)`, [
            id,
            json,
          ]);
        else
          await client.query(
            `INSERT INTO ${table}(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2`,
            [id, json],
          );
      }
      for (const row of old)
        if (!rows.some((r) => r[idKey] === row[idKey])) {
          if (key === "audits" || key === "events")
            throw new Error("Immutable record removal refused");
          await client.query(
            `DELETE FROM ${table} WHERE ${key === "locations" ? "report_id" : "id"}=$1`,
            [row[idKey]],
          );
        }
    }
  }
}
let singleton: Repository | undefined;
export function repository(): Repository {
  if (!singleton) {
    if (process.env.DATA_BACKEND === "postgres")
      singleton = new PostgresRepository();
    else if (demoEnabled()) singleton = new DemoRepository();
    else
      throw new Error(
        "Configure DATA_BACKEND; demo must be explicitly enabled",
      );
  }
  return singleton;
}
