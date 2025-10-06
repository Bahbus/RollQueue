import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const popupHtml = readFileSync(path.resolve(__dirname, '../../src/popup.html'), 'utf8');

export const loadPopupDom = () => {
  const dom = new JSDOM(popupHtml, { url: 'https://example.com' });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.navigator = window.navigator;
  return {
    dom,
    elements: {
      queueList: document.getElementById('queue-list'),
      playbackStatus: document.getElementById('playback-status'),
      audioLanguageSelect: document.getElementById('audio-language'),
      autoRemoveCheckbox: document.getElementById('auto-remove'),
      debugLoggingCheckbox: document.getElementById('debug-logging'),
      lastUpdatedEl: document.getElementById('last-updated'),
      playButton: document.getElementById('play-button'),
      pauseButton: document.getElementById('pause-button'),
      removeButton: document.getElementById('remove-button'),
      debugDumpButton: document.getElementById('debug-dump'),
    },
  };
};

export const cleanupDom = () => {
  if (global.window?.close) {
    global.window.close();
  }
  delete global.window;
  delete global.document;
  delete global.navigator;
  delete global.browser;
  delete global.chrome;
};
