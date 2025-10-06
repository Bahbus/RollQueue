import { vi } from "vitest";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createTrackedAsyncFunction(handler = async () => undefined, { autoResolve = true } = {}) {
  let currentHandler = handler;
  let shouldAutoResolve = autoResolve;
  const calls = [];

  const fn = vi.fn((...args) => {
    const deferred = createDeferred();
    const callRecord = {
      args,
      resolve: deferred.resolve,
      reject: deferred.reject,
      promise: deferred.promise,
      settled: false
    };
    calls.push(callRecord);

    if (shouldAutoResolve && typeof currentHandler === "function") {
      Promise.resolve()
        .then(() => currentHandler(...args))
        .then((value) => {
          if (!callRecord.settled) {
            callRecord.settled = true;
            deferred.resolve(value);
          }
        })
        .catch((error) => {
          if (!callRecord.settled) {
            callRecord.settled = true;
            deferred.reject(error);
          }
        });
    }

    return deferred.promise;
  });

  fn.__calls = calls;
  fn.__resolve = (value, index = calls.length - 1) => {
    const call = calls[index];
    if (call && !call.settled) {
      call.settled = true;
      call.resolve(value);
    }
  };
  fn.__reject = (error, index = calls.length - 1) => {
    const call = calls[index];
    if (call && !call.settled) {
      call.settled = true;
      call.reject(error);
    }
  };
  fn.__setHandler = (newHandler) => {
    currentHandler = newHandler;
  };
  fn.__setAutoResolve = (value) => {
    shouldAutoResolve = value;
  };

  return fn;
}

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
  const installedListeners = new Set();
  const localStore = new Map();

  const runtime = {
    sendMessage: createTrackedAsyncFunction(async () => undefined),
    onMessage: {
      addListener: vi.fn((callback) => {
        messageListeners.add(callback);
      }),
      removeListener: vi.fn((callback) => {
        messageListeners.delete(callback);
      }),
      hasListener: vi.fn((callback) => messageListeners.has(callback))
    },
    onInstalled: {
      addListener: vi.fn((callback) => {
        installedListeners.add(callback);
      }),
      removeListener: vi.fn((callback) => {
        installedListeners.delete(callback);
      }),
      hasListener: vi.fn((callback) => installedListeners.has(callback))
    }
  };
  runtime.__calls = {
    sendMessage: runtime.sendMessage.__calls
  };
  runtime.__resolveSendMessage = runtime.sendMessage.__resolve;
  runtime.__rejectSendMessage = runtime.sendMessage.__reject;
  runtime.__setSendMessageHandler = runtime.sendMessage.__setHandler;
  runtime.__setSendMessageAutoResolve = runtime.sendMessage.__setAutoResolve;

  const storage = {
    local: {
      get: createTrackedAsyncFunction(async (keys) => {
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
      set: createTrackedAsyncFunction(async (items = {}) => {
        Object.entries(items).forEach(([key, value]) => {
          localStore.set(key, value);
        });
      }),
      remove: createTrackedAsyncFunction(async (keys) => {
        toArray(keys).forEach((key) => {
          localStore.delete(key);
        });
      }),
      clear: createTrackedAsyncFunction(async () => {
        localStore.clear();
      })
    }
  };
  storage.local.__calls = {
    get: storage.local.get.__calls,
    set: storage.local.set.__calls,
    remove: storage.local.remove.__calls,
    clear: storage.local.clear.__calls
  };
  storage.local.__resolveGet = storage.local.get.__resolve;
  storage.local.__rejectGet = storage.local.get.__reject;
  storage.local.__resolveSet = storage.local.set.__resolve;
  storage.local.__rejectSet = storage.local.set.__reject;
  storage.local.__resolveRemove = storage.local.remove.__resolve;
  storage.local.__rejectRemove = storage.local.remove.__reject;
  storage.local.__resolveClear = storage.local.clear.__resolve;
  storage.local.__rejectClear = storage.local.clear.__reject;
  storage.local.__setGetHandler = storage.local.get.__setHandler;
  storage.local.__setSetHandler = storage.local.set.__setHandler;
  storage.local.__setRemoveHandler = storage.local.remove.__setHandler;
  storage.local.__setClearHandler = storage.local.clear.__setHandler;
  storage.local.__setGetAutoResolve = storage.local.get.__setAutoResolve;
  storage.local.__setSetAutoResolve = storage.local.set.__setAutoResolve;
  storage.local.__setRemoveAutoResolve = storage.local.remove.__setAutoResolve;
  storage.local.__setClearAutoResolve = storage.local.clear.__setAutoResolve;

  const tabs = {
    query: createTrackedAsyncFunction(async () => []),
    sendMessage: createTrackedAsyncFunction(async () => undefined),
    create: vi.fn(async (tab) => ({ id: Math.floor(Math.random() * 1000), ...tab }))
  };
  tabs.__calls = {
    query: tabs.query.__calls,
    sendMessage: tabs.sendMessage.__calls
  };
  tabs.__resolveQuery = tabs.query.__resolve;
  tabs.__rejectQuery = tabs.query.__reject;
  tabs.__resolveSendMessage = tabs.sendMessage.__resolve;
  tabs.__rejectSendMessage = tabs.sendMessage.__reject;
  tabs.__setQueryHandler = tabs.query.__setHandler;
  tabs.__setSendMessageHandler = tabs.sendMessage.__setHandler;
  tabs.__setQueryAutoResolve = tabs.query.__setAutoResolve;
  tabs.__setSendMessageAutoResolve = tabs.sendMessage.__setAutoResolve;

  const baseBrowser = {
    runtime,
    storage,
    tabs,
    __emitMessage(payload, sender = {}, sendResponse = () => {}) {
      messageListeners.forEach((listener) => listener(payload, sender, sendResponse));
    },
    __emitInstalled(details) {
      installedListeners.forEach((listener) => listener(details));
    },
    __storageStore: localStore
  };

  const browser = mergeDeep(baseBrowser, overrides);

  browser.runtime.onMessage.emit = browser.__emitMessage;
  browser.runtime.onInstalled.emit = browser.__emitInstalled;

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
