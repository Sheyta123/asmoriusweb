// Client-side persistence layer standing in for a backend.
// The whole database lives in memory and is persisted to IndexedDB, so every
// read is synchronous for the UI while writes survive reloads. Other tabs are
// kept in sync through a BroadcastChannel.

import { useMemo, useSyncExternalStore } from "react";
import type { Database } from "./types";
import { createSeedDatabase } from "./seed";

export const DB_VERSION = 1;

const IDB_NAME = "asmorius";
const IDB_STORE = "kv";
const IDB_KEY = "db";

let state: Database | null = null;
let version = 0;
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("asmorius-db") : null;

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function readStored(): Promise<Database | null> {
  const idb = await openIdb();
  if (!idb) return null;
  return new Promise((resolve) => {
    const req = idb.transaction(IDB_STORE).objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve((req.result as Database) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function writeStored(db: Database) {
  const idb = await openIdb();
  if (!idb) return;
  await new Promise<void>((resolve) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(db, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function emit() {
  version++;
  listeners.forEach((l) => l());
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    if (!state) return;
    await writeStored(state);
    channel?.postMessage("changed");
  }, 50);
}

/** Loads (or seeds) the database. Must resolve before the app renders. */
export async function initDb() {
  const stored = await readStored();
  if (stored && stored.version === DB_VERSION) {
    state = stored;
  } else {
    state = await createSeedDatabase();
    await writeStored(state);
  }
  channel?.addEventListener("message", async () => {
    const fresh = await readStored();
    if (fresh) {
      state = fresh;
      emit();
    }
  });
  emit();
}

export function getDb(): Database {
  if (!state) throw new Error("Database not initialised");
  return state;
}

/** Applies an in-place mutation, notifies subscribers and persists. */
export function mutate<T>(recipe: (db: Database) => T): T {
  const result = recipe(getDb());
  emit();
  schedulePersist();
  return result;
}

/** Wipes local data and re-seeds the demo dataset. */
export async function resetDb() {
  state = await createSeedDatabase();
  await writeStored(state);
  channel?.postMessage("changed");
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDbVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

/** Selects derived data from the database, recomputed whenever it changes. */
export function useDb<T>(selector: (db: Database) => T, deps: unknown[] = []): T {
  const v = useDbVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => selector(getDb()), [v, ...deps]);
}

export { uid } from "./ids";
