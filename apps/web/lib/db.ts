import "server-only";
import { createHash } from "node:crypto";

type DbError = { message: string };
type DbResult<T = any> = { data: T | null; error: DbError | null };
type FilterOp = "eq" | "in" | "gte";
type Filter = { column: string; op: FilterOp; value: unknown };
type Order = { column: string; ascending: boolean };
type Mode = "select" | "insert" | "update" | "upsert" | "delete";

const ACTIAN_URL = process.env.ACTIAN_VECTORAI_URL || process.env.ACTIAN_VECTORAI_REST_URL;
const ACTIAN_TOKEN = process.env.ACTIAN_VECTORAI_TOKEN || process.env.ACTIAN_VECTORAI_API_KEY || "";
const COLLECTION_PREFIX = process.env.ACTIAN_VECTORAI_COLLECTION_PREFIX || "vaidhya_";
const VECTOR_DIMENSION = Number(process.env.ACTIAN_VECTORAI_DIMENSION || 8);
const UUID_V5_NAMESPACE_URL = "6ba7b8119dad11d180b400c04fd430c8";

const PRIMARY_KEYS: Record<string, string> = {
  jurisdictions: "jurisdiction_id",
  patients: "patient_id",
  doctors: "doctor_id",
  visits: "visit_id",
  vitals_readings: "reading_id",
  diagnostic_reports: "report_id",
  branching_rules: "rule_id",
  question_bank: "cache_key",
  pharmacies: "pharmacy_id",
  stock_items: "stock_item_id",
  prescriptions: "prescription_id",
  bills: "bill_id",
  pharmacy_queue: "entry_id",
  regional_case_counts: "row_id",
  scheduled_reminders: "reminder_id",
};

type ActianPoint = {
  id: string | number;
  payload?: unknown;
  vector?: number[] | null;
};

class ActianHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function collectionFor(table: string) {
  return `${COLLECTION_PREFIX}${table}`;
}

function primaryKeyFor(table: string) {
  return PRIMARY_KEYS[table] || "id";
}

function stockStatus(quantity: unknown) {
  const qty = Number(quantity || 0);
  if (qty === 0) return "out_of_stock";
  if (qty < 10) return "low";
  return "in_stock";
}

function rowId(table: string, row: Record<string, any>) {
  if (table === "regional_case_counts") {
    row.row_id ||= `${row.region_id}:${row.disease_category}:${row.week_start_date}`;
  }

  const pk = primaryKeyFor(table);
  const id = row[pk];
  if (!id) {
    throw new Error(`Missing primary key ${pk} for ${table}`);
  }
  return String(id);
}

function uuidV5(name: string) {
  const hash = createHash("sha1")
    .update(Buffer.from(UUID_V5_NAMESPACE_URL, "hex"))
    .update(`vaidhya:${name}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function pointId(table: string, id: string) {
  return uuidV5(`${table}:${id}`);
}

function hashVector(seed: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < seed.length; i += 1) {
    h1 ^= seed.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= h1 >>> 7;
    h2 = Math.imul(h2, 0x85ebca6b);
  }

  return Array.from({ length: VECTOR_DIMENSION }, (_, i) => {
    const mixed = Math.imul(h1 ^ (i * 0x9e3779b1), h2 || 1);
    return ((mixed >>> 0) / 0xffffffff) * 2 - 1;
  });
}

function normalizePayload(payload: unknown): Record<string, any> {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  if (typeof payload === "object") return payload as Record<string, any>;
  return {};
}

function getPath(obj: any, path: string): unknown {
  return path.split(".").reduce((value, key) => {
    if (value == null) return undefined;
    return value[key];
  }, obj);
}

function applyDefaults(table: string, row: Record<string, any>) {
  const next = { ...row };

  if (table === "patients") next.created_at ||= nowIso();
  if (table === "visits") {
    next.status ||= "intake_in_progress";
    next.language ||= "en";
    next.created_at ||= nowIso();
  }
  if (table === "diagnostic_reports") next.generated_at ||= nowIso();
  if (table === "prescriptions") next.issued_at ||= nowIso();
  if (table === "pharmacy_queue") {
    next.status ||= "pending";
    next.created_at ||= nowIso();
  }
  if (table === "scheduled_reminders") next.status ||= "pending";
  if (table === "stock_items") next.status = stockStatus(next.quantity);

  return next;
}

function matchesFilter(row: Record<string, any>, filter: Filter) {
  const value = getPath(row, filter.column);
  if (filter.op === "eq") return value === filter.value;
  if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(value);
  if (filter.op === "gte") {
    if (value == null) return false;
    return String(value) >= String(filter.value);
  }
  return true;
}

function matchesOr(row: Record<string, any>, expression: string) {
  const clauses = expression.split(",").map((part) => part.trim()).filter(Boolean);
  if (clauses.length === 0) return true;

  return clauses.some((clause) => {
    const [column, op, ...rest] = clause.split(".");
    const expected = rest.join(".");
    const value = getPath(row, column);

    if (op === "eq") return String(value) === expected;
    if (op === "is" && expected === "null") return value == null;
    return false;
  });
}

function sortRows(rows: Record<string, any>[], order: Order | null) {
  if (!order) return rows;

  return [...rows].sort((a, b) => {
    const av = getPath(a, order.column);
    const bv = getPath(b, order.column);
    if (av == null && bv == null) return 0;
    if (av == null) return order.ascending ? -1 : 1;
    if (bv == null) return order.ascending ? 1 : -1;
    const comparison = String(av).localeCompare(String(bv), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return order.ascending ? comparison : -comparison;
  });
}

export class ActianVectorDb {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  from(table: string) {
    return new ActianTableQuery(this, table);
  }

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.token) {
      headers.set("Authorization", `Bearer ${this.token}`);
      headers.set("api-key", this.token);
    }

    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const detail = body?.status?.error || body?.error || response.statusText;
      throw new ActianHttpError(String(detail), response.status);
    }

    return body;
  }

  async ensureCollection(table: string) {
    try {
      await this.request(`/collections/${encodeURIComponent(collectionFor(table))}`, {
        method: "PUT",
        body: JSON.stringify({
          vectors: { size: VECTOR_DIMENSION, distance: "Cosine" },
        }),
      });
    } catch (error) {
      if (error instanceof ActianHttpError && error.status === 409) return;
      throw error;
    }
  }

  async rawRows(table: string): Promise<Record<string, any>[]> {
    const collection = encodeURIComponent(collectionFor(table));
    const rows: Record<string, any>[] = [];
    let offset: unknown = undefined;

    do {
      const body = await this.request(`/collections/${collection}/points/scroll`, {
        method: "POST",
        body: JSON.stringify({
          limit: 256,
          offset,
          with_payload: true,
          with_vectors: false,
        }),
      });
      const result = body?.result;
      const points = Array.isArray(result) ? result : result?.points || [];
      rows.push(...points.map((point: ActianPoint) => normalizePayload(point.payload)));
      offset = Array.isArray(result) ? undefined : result?.next_page_offset;
    } while (offset);

    return rows.map((row) => applyDefaults(table, row));
  }

  async upsertRows(table: string, rows: Record<string, any>[]) {
    if (rows.length === 0) return;

    await this.ensureCollection(table);
    const points = rows.map((row) => {
      const payload = applyDefaults(table, row);
      const id = rowId(table, payload);
      return { id: pointId(table, id), vector: hashVector(`${table}:${id}`), payload };
    });

    await this.request(`/collections/${encodeURIComponent(collectionFor(table))}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify({ points }),
    });
  }
}

class ActianTableQuery implements PromiseLike<DbResult> {
  private mode: Mode = "select";
  private filters: Filter[] = [];
  private orExpression: string | null = null;
  private orderBy: Order | null = null;
  private maxRows: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;
  private mutationRows: Record<string, any>[] = [];
  private patch: Record<string, any> = {};
  private conflictColumn: string | null = null;

  constructor(
    private readonly client: ActianVectorDb,
    private readonly table: string,
  ) {}

  select(_columns = "*") {
    return this;
  }

  insert(rows: Record<string, any> | Record<string, any>[]) {
    this.mode = "insert";
    this.mutationRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch: Record<string, any>) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }

  upsert(
    rows: Record<string, any> | Record<string, any>[],
    options?: { onConflict?: string },
  ) {
    this.mode = "upsert";
    this.mutationRows = Array.isArray(rows) ? rows : [rows];
    this.conflictColumn = options?.onConflict || null;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, op: "in", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, op: "gte", value });
    return this;
  }

  or(expression: string) {
    this.orExpression = expression;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<DbResult> {
    try {
      if (this.mode === "insert") return await this.executeInsert();
      if (this.mode === "upsert") return await this.executeUpsert();
      if (this.mode === "update") return await this.executeUpdate();
      if (this.mode === "delete") return await this.executeDelete();
      return await this.executeSelect();
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private async executeSelect(): Promise<DbResult> {
    const rows = await this.queryRows();
    return this.result(rows);
  }

  private async executeInsert(): Promise<DbResult> {
    const rows = this.mutationRows.map((row) => applyDefaults(this.table, row));
    await this.client.upsertRows(this.table, rows);
    return this.result(rows);
  }

  private async executeUpsert(): Promise<DbResult> {
    const existing = await this.safeRawRows();
    const pk = primaryKeyFor(this.table);
    const rows = this.mutationRows.map((row) => {
      const next = applyDefaults(this.table, row);
      if (this.conflictColumn && this.conflictColumn !== pk) {
        const match = existing.find((candidate) => candidate[this.conflictColumn!] === next[this.conflictColumn!]);
        if (match) next[pk] = match[pk];
      }
      return next;
    });

    await this.client.upsertRows(this.table, rows);
    return this.result(rows);
  }

  private async executeUpdate(): Promise<DbResult> {
    const rows = await this.queryRows(false);
    const updated = rows.map((row) => applyDefaults(this.table, { ...row, ...this.patch }));
    await this.client.upsertRows(this.table, updated);
    return this.result(updated);
  }

  private async executeDelete(): Promise<DbResult> {
    const rows = await this.queryRows(false);
    if (rows.length === 0) return this.result([]);

    await this.client.request(`/collections/${encodeURIComponent(collectionFor(this.table))}/points/delete`, {
      method: "POST",
      body: JSON.stringify({ points: rows.map((row) => pointId(this.table, rowId(this.table, row))) }),
    });
    return this.result(rows);
  }

  private async queryRows(withHydration = true) {
    let rows = await this.safeRawRows();
    if (withHydration) rows = await hydrateRows(this.client, this.table, rows);

    rows = rows.filter((row) => this.filters.every((filter) => matchesFilter(row, filter)));
    if (this.orExpression) rows = rows.filter((row) => matchesOr(row, this.orExpression!));
    rows = sortRows(rows, this.orderBy);
    if (this.maxRows != null) rows = rows.slice(0, this.maxRows);
    return rows;
  }

  private async safeRawRows() {
    try {
      return await this.client.rawRows(this.table);
    } catch (error) {
      if (error instanceof ActianHttpError && error.status === 404) return [];
      throw error;
    }
  }

  private result(rows: Record<string, any>[]): DbResult {
    if (this.singleMode === "single") {
      if (rows.length !== 1) {
        return { data: null, error: { message: `Expected one ${this.table} row, found ${rows.length}` } };
      }
      return { data: rows[0], error: null };
    }

    if (this.singleMode === "maybeSingle") {
      return { data: rows[0] || null, error: null };
    }

    return { data: rows, error: null };
  }
}

async function hydrateRows(client: ActianVectorDb, table: string, rows: Record<string, any>[]) {
  if (rows.length === 0) return rows;

  if (table === "visits") {
    const [patients, reports, prescriptions, doctors] = await Promise.all([
      safeRawRows(client, "patients"),
      safeRawRows(client, "diagnostic_reports"),
      safeRawRows(client, "prescriptions"),
      safeRawRows(client, "doctors"),
    ]);
    return rows.map((row) => ({
      ...row,
      patients: patients.find((p) => p.patient_id === row.patient_id) || null,
      diagnostic_reports: reports
        .filter((report) => report.visit_id === row.visit_id)
        .sort((a, b) => String(a.generated_at || "").localeCompare(String(b.generated_at || ""))),
      prescriptions: prescriptions
        .filter((rx) => rx.visit_id === row.visit_id)
        .sort((a, b) => String(a.issued_at || "").localeCompare(String(b.issued_at || ""))),
      doctors: doctors.find((doctor) => doctor.doctor_id === row.claimed_by_doctor_id) || null,
    }));
  }

  if (table === "prescriptions") {
    const [doctors, visits, patients] = await Promise.all([
      safeRawRows(client, "doctors"),
      safeRawRows(client, "visits"),
      safeRawRows(client, "patients"),
    ]);
    return rows.map((row) => {
      const visit = visits.find((v) => v.visit_id === row.visit_id) || null;
      const patient = visit ? patients.find((p) => p.patient_id === visit.patient_id) || null : null;
      return {
        ...row,
        doctors: doctors.find((doctor) => doctor.doctor_id === row.doctor_id) || null,
        visits: visit ? { ...visit, patients: patient } : null,
      };
    });
  }

  if (table === "pharmacies") {
    const stockItems = await safeRawRows(client, "stock_items");
    return rows.map((row) => ({
      ...row,
      stock_items: stockItems.filter((item) => item.pharmacy_id === row.pharmacy_id),
    }));
  }

  if (table === "pharmacy_queue") {
    const prescriptions = await hydrateRows(client, "prescriptions", await safeRawRows(client, "prescriptions"));
    return rows.map((row) => ({
      ...row,
      prescriptions: prescriptions.find((rx) => rx.prescription_id === row.prescription_id) || null,
    }));
  }

  return rows;
}

async function safeRawRows(client: ActianVectorDb, table: string) {
  try {
    return await client.rawRows(table);
  } catch (error) {
    if (error instanceof ActianHttpError && error.status === 404) return [];
    throw error;
  }
}

/**
 * Server-side Actian VectorAI DB adapter. It intentionally keeps the old
 * `db.from(...).select/insert/update` shape so the application code does not
 * need to learn storage details at every call site.
 */
export const db = ACTIAN_URL ? new ActianVectorDb(ACTIAN_URL, ACTIAN_TOKEN) : null;
