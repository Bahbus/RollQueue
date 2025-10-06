import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDom, renderEpisodeCards } from "./dom.fixtures.js";

const loadContentModule = async () => {
  vi.resetModules();
  return import("../../src/content.js");
};

describe("content lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearDom();
    window.history.replaceState({}, "", "/watch/episode-1");
  });

  it("invokes scheduled helpers once per run", async () => {
    const content = await loadContentModule();
    const annotateSpy = vi.fn();
    const locateSpy = vi.fn();
    const initSelectionSpy = vi.fn();

    content.__testInternals.overrideScheduleHelpers({
      annotateEpisodeCards: annotateSpy,
      locateAndMonitorVideo: locateSpy,
      initCurrentEpisodeSelection: initSelectionSpy
    });

    content.scheduleTasks();

    expect(annotateSpy).toHaveBeenCalledTimes(1);
    expect(locateSpy).toHaveBeenCalledTimes(1);
    expect(initSelectionSpy).toHaveBeenCalledTimes(1);

    content.__testInternals.resetScheduleHelpers();
  });

  it("initializes and tears down observers, intervals, and listeners", async () => {
    const originalMutationObserver = globalThis.MutationObserver;
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();

    globalThis.MutationObserver = vi.fn().mockImplementation(function mockObserver() {
      this.observe = observeSpy;
      this.disconnect = disconnectSpy;
    });

    try {
      const content = await loadContentModule();
      renderEpisodeCards();

      const setIntervalSpy = vi.spyOn(window, "setInterval");
      const clearIntervalSpy = vi.spyOn(window, "clearInterval");
      const addListenerSpy = globalThis.browser.runtime.onMessage.addListener;
      const removeListenerSpy = globalThis.browser.runtime.onMessage.removeListener;

      content.initContent();

      expect(observeSpy).toHaveBeenCalledTimes(1);
      expect(observeSpy).toHaveBeenCalledWith(
        document.body,
        expect.objectContaining({ childList: true, subtree: true })
      );

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(setIntervalSpy.mock.calls[0][0]).toBe(content.scheduleTasks);
      expect(setIntervalSpy.mock.calls[0][1]).toBe(2000);
      const intervalId = setIntervalSpy.mock.results[0]?.value;

      expect(addListenerSpy).toHaveBeenCalledWith(content.contentMessageListener);

      content.teardownContent();

      if (intervalId !== undefined) {
        expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
      } else {
        expect(clearIntervalSpy).toHaveBeenCalled();
      }
      expect(removeListenerSpy).toHaveBeenCalledWith(content.contentMessageListener);
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.MutationObserver = originalMutationObserver;
    }
  });
});
