import { afterEach, beforeEach, vi } from "vitest";
import { cleanup as cleanupDom } from "@testing-library/dom";
import { installMockBrowserApi, resetBrowserApi } from "./support/mockBrowserApi.js";
import { useMockedTimers, restoreRealTimers } from "./support/timers.js";

beforeEach(() => {
  installMockBrowserApi();
  useMockedTimers();
});

afterEach(() => {
  if (typeof cleanupDom === "function") {
    cleanupDom();
  }
  restoreRealTimers();
  resetBrowserApi();
  vi.clearAllMocks();
  vi.resetModules();
});
