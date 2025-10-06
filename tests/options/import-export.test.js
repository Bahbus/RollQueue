import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupOptionsDom } from './setup.js';
import { MESSAGE_TYPES, DEFAULT_SETTINGS } from '../../src/constants.js';

describe('options import/export helpers', () => {
  let document;
  let elements;
  let initOptions;
  let downloadJson;

  beforeEach(async () => {
    ({ document, elements } = setupOptionsDom());
    browser.runtime.onMessage.addListener.mockImplementation(() => {});
    browser.runtime.sendMessage.__setHandler(async (message) => {
      if (message.type === MESSAGE_TYPES.GET_STATE) {
        return {
          queue: [],
          currentEpisodeId: null,
          playbackState: 'idle',
          settings: { ...DEFAULT_SETTINGS },
          lastUpdated: Date.now()
        };
      }
      return undefined;
    });

    const module = await import('../../src/options.js');
    initOptions = module.initOptions;
    downloadJson = module.downloadJson;
    await initOptions({ document });
  });

  it('creates a temporary anchor to trigger JSON downloads', () => {
    const clickSpy = vi.spyOn(window.HTMLAnchorElement.prototype, 'click');

    downloadJson('export.json', { foo: 'bar' }, document);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('a[href^="blob:"]').length).toBe(0);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });

  it('imports a queue file and notifies the user on success', async () => {
    const queueItems = [{ id: 'item-1' }, { id: 'item-2' }];
    const file = {
      text: vi.fn(() => Promise.resolve(JSON.stringify(queueItems)))
    };

    Object.defineProperty(elements.queueFileInput, 'files', {
      configurable: true,
      value: [file]
    });

    elements.queueFileInput.dispatchEvent(new window.Event('change'));

    await Promise.resolve();
    await Promise.all(
      browser.runtime.__calls.sendMessage.map((call) => call.promise.catch(() => undefined))
    );

    const setQueueCall = browser.runtime.sendMessage.mock.calls.find(
      ([message]) => message.type === MESSAGE_TYPES.SET_QUEUE
    );

    expect(setQueueCall).toBeTruthy();
    expect(setQueueCall[0].payload.queue).toEqual(queueItems);
    expect(globalThis.alert).toHaveBeenCalledWith('Queue imported successfully');
    expect(elements.queueFileInput.value).toBe('');
  });

  it('shows an error alert when imported JSON is invalid', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const file = {
      text: vi.fn(() => Promise.resolve('{"invalid":true}'))
    };

    Object.defineProperty(elements.queueFileInput, 'files', {
      configurable: true,
      value: [file]
    });

    elements.queueFileInput.dispatchEvent(new window.Event('change'));

    await Promise.resolve();
    await Promise.all(
      browser.runtime.__calls.sendMessage.map((call) => call.promise.catch(() => undefined))
    );

    const setQueueCalls = browser.runtime.sendMessage.mock.calls.filter(
      ([message]) => message.type === MESSAGE_TYPES.SET_QUEUE
    );

    expect(setQueueCalls).toHaveLength(0);
    expect(globalThis.alert).toHaveBeenCalledWith(
      'Failed to import queue. Please make sure the file is valid.'
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(elements.queueFileInput.value).toBe('');

    consoleErrorSpy.mockRestore();
  });
});
