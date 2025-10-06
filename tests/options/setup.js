import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

const templateHtml = (() => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const htmlPath = resolve(currentDir, '../../src/options.html');
  const rawHtml = readFileSync(htmlPath, 'utf8');
  return rawHtml.replace(/<script[^>]*src="options\.js"[^>]*><\/script>/i, '');
})();

export const setupOptionsDom = () => {
  const dom = new JSDOM(templateHtml, {
    url: 'http://localhost',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;

  globalThis.window = window;
  globalThis.document = document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLInputElement = window.HTMLInputElement;
  globalThis.Event = window.Event;
  globalThis.File = window.File;
  globalThis.Blob = window.Blob;
  globalThis.navigator = window.navigator;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.confirm = vi.fn(() => true);
  globalThis.alert = vi.fn();

  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = vi.fn();
  globalThis.URL = window.URL;

  const elements = {
    autoRemoveCheckbox: document.getElementById('auto-remove'),
    debugLoggingCheckbox: document.getElementById('debug-logging'),
    audioLanguageSelect: document.getElementById('audio-language'),
    clearQueueButton: document.getElementById('clear-queue'),
    exportQueueButton: document.getElementById('export-queue'),
    importQueueButton: document.getElementById('import-queue'),
    queueFileInput: document.getElementById('queue-file'),
    stateDumpEl: document.getElementById('state-dump')
  };

  return { dom, window, document, elements };
};
