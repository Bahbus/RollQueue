import {
  afterEach as vitestAfterEach,
  beforeEach as vitestBeforeEach,
  describe,
  it,
  expect
} from "vitest";

const resolveBrowserMock = (path) => {
  if (!path) {
    return undefined;
  }
  return path.split(".").reduce((accumulator, segment) => {
    if (accumulator && segment in accumulator) {
      return accumulator[segment];
    }
    return undefined;
  }, globalThis.browser);
};

const verifyBrowserCalls = (expectations = [], context = {}) => {
  expectations.forEach((expectation) => {
    const {
      api,
      callIndex = 0,
      matcher,
      args,
      times,
      message
    } = expectation;
    const mock = resolveBrowserMock(api);

    if (!mock || typeof mock.mock === "undefined") {
      throw new Error(`Expected browser mock for path "${api}" to be a vi.fn()`);
    }

    if (typeof times === "number") {
      expect(mock).toHaveBeenCalledTimes(times);
    }

    if (Array.isArray(args)) {
      expect(mock).toHaveBeenNthCalledWith(callIndex + 1, ...args);
    }

    if (matcher) {
      const calls = mock.mock.calls || [];
      const callArgs = calls[callIndex] || [];
      if (typeof matcher === "function") {
        matcher({ callArgs, calls, mock, context, message });
      } else if (matcher instanceof RegExp) {
        const [firstArg] = callArgs;
        expect(String(firstArg)).toMatch(matcher);
      } else {
        const [firstArg] = callArgs;
        expect(firstArg).toMatchObject(matcher);
      }
    }
  });
};

export function describeMessageHandler({
  name,
  getHandler,
  scenarios,
  beforeEach: beforeEachHook,
  afterEach: afterEachHook
}) {
  if (typeof name !== "string" || !name) {
    throw new Error("describeMessageHandler requires a suite name");
  }
  if (typeof getHandler !== "function") {
    throw new Error("describeMessageHandler requires a getHandler function");
  }
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error("describeMessageHandler requires at least one scenario");
  }

  describe(name, () => {
    if (beforeEachHook) {
      vitestBeforeEach(async () => {
        await beforeEachHook();
      });
    }

    scenarios.forEach((scenario) => {
      const {
        description,
        type,
        payload,
        message: explicitMessage,
        setup,
        teardown,
        assert,
        expectedBrowserCalls,
        skip
      } = scenario;

      const testFn = skip ? it.skip : it;

      testFn(description, async () => {
        const handler = await getHandler();
        if (typeof handler !== "function") {
          throw new Error("describeMessageHandler expected getHandler to resolve to a function");
        }

        const context = (await (setup?.() ?? {})) || {};
        const message = explicitMessage ?? { type, payload };
        const result = await handler(message);

        if (assert) {
          await assert({ result, context, message });
        }

        if (expectedBrowserCalls) {
          verifyBrowserCalls(expectedBrowserCalls, { ...context, result, message });
        }

        if (teardown) {
          await teardown({ result, context, message });
        }
      });
    });

    if (afterEachHook) {
      vitestAfterEach(async () => {
        await afterEachHook();
      });
    }
  });
}

export function describeMenuAction({
  name,
  scenarios,
  beforeEach: beforeEachHook,
  afterEach: afterEachHook
}) {
  if (typeof name !== "string" || !name) {
    throw new Error("describeMenuAction requires a suite name");
  }
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error("describeMenuAction requires at least one scenario");
  }

  describe(name, () => {
    if (beforeEachHook) {
      vitestBeforeEach(async () => {
        await beforeEachHook();
      });
    }

    scenarios.forEach((scenario) => {
      const {
        description,
        setup,
        act,
        assert,
        expectedBrowserCalls,
        teardown,
        skip
      } = scenario;
      const testFn = skip ? it.skip : it;

      testFn(description, async () => {
        const context = (await (setup?.() ?? {})) || {};
        await act?.(context);

        if (expectedBrowserCalls) {
          verifyBrowserCalls(expectedBrowserCalls, context);
        }

        if (assert) {
          await assert(context);
        }

        await teardown?.(context);
      });
    });

    if (afterEachHook) {
      vitestAfterEach(async () => {
        await afterEachHook();
      });
    }
  });
}
