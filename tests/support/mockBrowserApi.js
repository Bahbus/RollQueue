import { vi } from "vitest";

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}

function mergeDeep(target, source = {}) {
  return Object.entries(source).reduce((acc, [key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      acc[key] = mergeDeep(acc[key] ?? {}, value);
    } else {
      acc[key] = value;
    }

    return acc;
  }, { ...target });
}

export function createMockBrowser(overrides = {}) {
  const messageListeners = new Set();
  const localStore = new Map();

  const runtime = {
    sendMessage: vi.fn(async () => undefined),
    onMessage: {
      addListener: vi.fn((callback) => {
        messageListeners.add(callback);
      }),
      removeListener: vi.fn((callback) => {
        messageListeners.delete(callback);
      }),
      hasListener: vi.fn((callback) => messageListeners.has(callback))
    }
  };

  const storage = {
    local: {
      get: vi.fn(async (keys) => {
        const requestedKeys = Array.isArray(keys)
          ? keys
          : keys && typeof keys === "object" && !Array.isArray(keys)
            ? Object.keys(keys)
            : toArray(keys);

        if (requestedKeys.length === 0) {
          return Object.fromEntries(localStore.entries());
        }

        return requestedKeys.reduce((accumulator, key) => {
          if (localStore.has(key)) {
            accumulator[key] = localStore.get(key);
          } else if (keys && typeof keys === "object" && key in keys) {
            accumulator[key] = keys[key];
          }

          return accumulator;
        }, {});
      }),
      set: vi.fn(async (items = {}) => {
        Object.entries(items).forEach(([key, value]) => {
          localStore.set(key, value);
        });
      }),
      remove: vi.fn(async (keys) => {
        toArray(keys).forEach((key) => {
          localStore.delete(key);
        });
      }),
      clear: vi.fn(async () => {
        localStore.clear();
      })
    }
  };

  const tabs = {
    query: vi.fn(async () => []),
    sendMessage: vi.fn(async () => undefined),
    create: vi.fn(async (tab) => ({ id: Math.floor(Math.random() * 1000), ...tab }))
  };

  const baseBrowser = {
    runtime,
    storage,
    tabs,
    __emitMessage(payload, sender = {}, sendResponse = () => {}) {
      messageListeners.forEach((listener) => listener(payload, sender, sendResponse));
    },
    __storageStore: localStore
  };

  const browser = mergeDeep(baseBrowser, overrides);

  browser.runtime.onMessage.emit = browser.__emitMessage;

  return browser;
}

export function installMockBrowserApi(overrides = {}) {
  const browser = createMockBrowser(overrides);
  globalThis.browser = browser;
  globalThis.chrome = browser;
  return browser;
}

export function resetBrowserApi() {
  delete globalThis.browser;
  delete globalThis.chrome;
}
