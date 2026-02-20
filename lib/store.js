// Shared results storage
// Local dev: JSON file (survives server restarts)
// Production: Upstash Redis — set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const STORE_KEY = "onramp-shared-matrix";
const DATA_DIR = join(process.cwd(), ".data");
const DATA_FILE = join(DATA_DIR, "shared-results.json");

// --- Upstash Redis (production) ---

function getRedis() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = require("@upstash/redis");
      return new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch {
      return null;
    }
  }
  return null;
}

// --- JSON file (local dev) ---

async function readJsonFile() {
  try {
    const data = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeJsonFile(data) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- Public API ---

export async function getSharedResults() {
  const redis = getRedis();
  if (redis) {
    return (await redis.get(STORE_KEY)) || {};
  }
  return readJsonFile();
}

export async function submitResult({ browserKey, column, status, note, userAgent, testerName }) {
  const redis = getRedis();
  const current = redis ? ((await redis.get(STORE_KEY)) || {}) : await readJsonFile();

  if (!current[browserKey]) current[browserKey] = {};

  const existing = current[browserKey][column];
  const testers = existing?.testers || [];

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

  if (redis) {
    await redis.set(STORE_KEY, current);
  } else {
    await writeJsonFile(current);
  }

  return current;
}

export async function clearSharedResults() {
  const redis = getRedis();
  if (redis) {
    await redis.del(STORE_KEY);
  } else {
    await writeJsonFile({});
  }
}
