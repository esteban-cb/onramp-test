// Shared results storage
// Local dev: JSON file (survives server restarts)
// Production: Redis via REDIS_URL env var

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createClient } from "redis";

const STORE_KEY = "onramp-shared-matrix";
const DATA_DIR = join(process.cwd(), ".data");
const DATA_FILE = join(DATA_DIR, "shared-results.json");

// --- Redis (production) ---

let redisClient = null;

async function getRedis() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on("error", () => {});
    await redisClient.connect();
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
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
  const redis = await getRedis();
  if (redis) {
    const raw = await redis.get(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  }
  return readJsonFile();
}

export async function submitResult({ browserKey, column, status, note, userAgent, testerName }) {
  const redis = await getRedis();
  let current;

  if (redis) {
    const raw = await redis.get(STORE_KEY);
    current = raw ? JSON.parse(raw) : {};
  } else {
    current = await readJsonFile();
  }

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
    await redis.set(STORE_KEY, JSON.stringify(current));
  } else {
    await writeJsonFile(current);
  }

  return current;
}

export async function clearSharedResults() {
  const redis = await getRedis();
  if (redis) {
    await redis.del(STORE_KEY);
  } else {
    await writeJsonFile({});
  }
}
