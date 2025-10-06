import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/dom";
import { installMockBrowserApi, resetBrowserApi } from "./support/mockBrowserApi.js";
import { useMockedTimers, restoreRealTimers } from "./support/timers.js";

beforeEach(() => {
  installMockBrowserApi();
  useMockedTimers();
});

afterEach(() => {
  cleanup();
  restoreRealTimers();
  resetBrowserApi();
  vi.clearAllMocks();
  vi.resetModules();
});
