// Shared results storage
// Local dev: in-memory (resets on server restart)
// Production: Vercel KV (persistent) — set KV_REST_API_URL + KV_REST_API_TOKEN env vars

const STORE_KEY = "onramp-shared-matrix";

// In-memory fallback for local dev
let memoryStore = {};

async function getKV() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import("@vercel/kv");
      return kv;
    } catch {
      return null;
    }
  }
  return null;
}

export async function getSharedResults() {
  const kv = await getKV();
  if (kv) {
    return (await kv.get(STORE_KEY)) || {};
  }
  return memoryStore;
}

export async function submitResult({ browserKey, column, status, note, userAgent, testerName }) {
  const kv = await getKV();
  const current = kv ? ((await kv.get(STORE_KEY)) || {}) : memoryStore;

  if (!current[browserKey]) current[browserKey] = {};

  const existing = current[browserKey][column];
  const testers = existing?.testers || [];

  // Add tester if not already in list
  if (testerName && !testers.includes(testerName)) {
    testers.push(testerName);
  }

  current[browserKey][column] = {
    status,
    note,
    testCount: testers.length,
    testers,
    lastTested: new Date().toISOString(),
    lastUserAgent: userAgent,
    lastTester: testerName || "Anonymous",
  };

  if (kv) {
    await kv.set(STORE_KEY, current);
  } else {
    memoryStore = current;
  }

  return current;
}

export async function clearSharedResults() {
  const kv = await getKV();
  if (kv) {
    await kv.del(STORE_KEY);
  }
  memoryStore = {};
}
