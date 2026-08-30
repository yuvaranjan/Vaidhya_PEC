const { createHash } = require("node:crypto");
const fs = require("node:fs");

loadEnv("apps/web/.env.local");

const baseUrl = (process.env.ACTIAN_VECTORAI_URL || process.env.ACTIAN_VECTORAI_REST_URL || "http://localhost:6573").replace(/\/$/, "");
const token = process.env.ACTIAN_VECTORAI_TOKEN || "";
const prefix = process.env.ACTIAN_VECTORAI_COLLECTION_PREFIX || "vaidhya_";
const dimension = Number(process.env.ACTIAN_VECTORAI_DIMENSION || 8);
const namespaceUrl = "6ba7b8119dad11d180b400c04fd430c8";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] == null) process.env[match[1]] = match[2];
  }
}

function headers() {
  const next = { "Content-Type": "application/json" };
  if (token) next.Authorization = `Bearer ${token}`;
  return next;
}

function hashVector(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i += 1) {
    h1 ^= seed.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= h1 >>> 7;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return Array.from({ length: dimension }, (_, i) => {
    const mixed = Math.imul(h1 ^ (i * 0x9e3779b1), h2 || 1);
    return ((mixed >>> 0) / 0xffffffff) * 2 - 1;
  });
}

function uuidV5(name) {
  const hash = createHash("sha1")
    .update(Buffer.from(namespaceUrl, "hex"))
    .update(`vaidhya:${name}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok && response.status !== 409) {
    throw new Error(`${response.status} ${body?.status?.error || body?.error || response.statusText}`);
  }
  return body;
}

async function ensureCollection(table) {
  await request(`/collections/${encodeURIComponent(prefix + table)}`, {
    method: "PUT",
    body: JSON.stringify({ vectors: { size: dimension, distance: "Cosine" } }),
  });
}

async function upsertVisit(visit) {
  await ensureCollection("visits");
  await request(`/collections/${encodeURIComponent(prefix + "visits")}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({
      points: [
        {
          id: uuidV5(`visits:${visit.visit_id}`),
          vector: hashVector(`visits:${visit.visit_id}`),
          payload: visit,
        },
      ],
    }),
  });
}

async function scrollVisits() {
  const body = await request(`/collections/${encodeURIComponent(prefix + "visits")}/points/scroll`, {
    method: "POST",
    body: JSON.stringify({ limit: 256, with_payload: true, with_vectors: false }),
  });
  const result = body?.result;
  const points = Array.isArray(result) ? result : result?.points || [];
  return points.map((point) => point.payload || {});
}

async function test() {
  const visitId = "test_visit_123";
  const doctorId = "doc_001";

  console.log("Inserting visit...");
  await upsertVisit({
    visit_id: visitId,
    patient_id: "pat_001",
    edge_jurisdiction_id: "jur_thrissur_01",
    status: "awaiting_doctor",
    language: "en",
    created_at: new Date().toISOString(),
  });

  console.log("Claiming visit...");
  const visits = await scrollVisits();
  const visit = visits.find((row) => row.visit_id === visitId);
  if (!visit) throw new Error("Inserted visit was not found");
  if (visit.status !== "awaiting_doctor" && visit.claimed_by_doctor_id && visit.claimed_by_doctor_id !== doctorId) {
    throw new Error(`Visit is not claimable: ${JSON.stringify(visit)}`);
  }

  const claimed = { ...visit, status: "in_consult", claimed_by_doctor_id: doctorId };
  await upsertVisit(claimed);
  console.log("Claim Data:", [{ visit_id: claimed.visit_id }]);
  console.log("Claim Error:", null);
}

test().catch((error) => {
  console.error(error);
  process.exit(1);
});
