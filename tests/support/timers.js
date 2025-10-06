import { vi } from "vitest";

export function useMockedTimers() {
  vi.useFakeTimers();
}

export function restoreRealTimers() {
  vi.useRealTimers();
}

export function advanceTimeBy(ms) {
  vi.advanceTimersByTime(ms);
}

export function runAllTimers() {
  vi.runAllTimers();
}
