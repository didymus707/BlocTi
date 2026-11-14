// STORAGE: a thin, forgiving wrapper around localStorage.
//
// There is no backend, so the browser's localStorage is where runs, history
// and the block's placement live. It can be missing or throw (private
// browsing, storage full, blocked site data), so every read and write is
// guarded and the app keeps working, it just forgets.

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const browserStore = (): KeyValueStore | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

// parse returns null for anything it does not recognise
export const readJson = <T>(
  store: KeyValueStore | null,
  key: string,
  parse: (raw: unknown) => T | null,
): T | null => {
  try {
    const text = store?.getItem(key);
    return text ? parse(JSON.parse(text)) : null;
  } catch {
    return null;
  }
};

export const writeJson = (store: KeyValueStore | null, key: string, value: unknown): boolean => {
  try {
    if (!store) return false;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const removeKey = (store: KeyValueStore | null, key: string): void => {
  try {
    store?.removeItem(key);
  } catch {
    // nothing to do; the next write replaces it anyway
  }
};

// an in-memory store, for tests and as a stand-in when the browser has none
export const memoryStore = (): KeyValueStore => {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
};
