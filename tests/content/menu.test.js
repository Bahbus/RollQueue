import { describe, expect, it, beforeEach } from "vitest";
import {
  annotateEpisodeCards,
  injectMenuItems,
  gatherEpisodesFromCard,
  MENU_ITEM_ATTRIBUTE,
  MESSAGE_TYPES
} from "../../src/content.js";
import { renderEpisodeCards, clearDom } from "./dom.fixtures.js";

describe("content menu helpers", () => {
  beforeEach(() => {
    clearDom();
    globalThis.browser.runtime.sendMessage.mockClear();
  });

  it("annotates episode cards with metadata", () => {
    const { cards } = renderEpisodeCards();

    annotateEpisodeCards();

    cards.forEach((card, index) => {
      const expectedId = `episode-${index + 1}`;
      expect(card.getAttribute("data-rollqueue-episode-id")).toBe(expectedId);
      expect(card.getAttribute("data-rollqueue-episode-url")).toContain(expectedId);
      expect(card.getAttribute("data-rollqueue-episode-title")).toBe(`Episode ${index + 1}`);
      expect(card.getAttribute("data-rollqueue-episode-subtitle")).toContain(`Episode ${index + 1}`);
      expect(card.getAttribute("data-rollqueue-episode-thumbnail")).toContain(`thumb-${index + 1}`);
    });
  });

  it("injects menu items idempotently", () => {
    const { menus } = renderEpisodeCards();

    annotateEpisodeCards();

    const menu = menus[0];

    injectMenuItems(menu);
    injectMenuItems(menu);

    const injectedItems = menu.querySelectorAll(`[${MENU_ITEM_ATTRIBUTE}]`);
    expect(injectedItems.length).toBe(2);
  });

  it("dispatches correct messages from injected menu actions", async () => {
    const { cards, menus } = renderEpisodeCards();
    annotateEpisodeCards();
    const menu = menus[0];
    const card = cards[0];

    injectMenuItems(menu);

    const items = menu.querySelectorAll(`[${MENU_ITEM_ATTRIBUTE}] button`);
    expect(items.length).toBe(2);

    items[0].click();
    await Promise.resolve();

    const firstCall = globalThis.browser.runtime.sendMessage.mock.calls[0][0];
    expect(firstCall).toMatchObject({
      type: MESSAGE_TYPES.ADD_EPISODE,
      payload: expect.objectContaining({
        id: card.getAttribute("data-rollqueue-episode-id")
      })
    });

    items[1].click();
    await Promise.resolve();

    const secondCall = globalThis.browser.runtime.sendMessage.mock.calls[1][0];
    expect(secondCall).toMatchObject({
      type: MESSAGE_TYPES.ADD_EPISODE_AND_NEWER,
      payload: expect.arrayContaining([
        expect.objectContaining({ id: card.getAttribute("data-rollqueue-episode-id") })
      ])
    });

    const gatheredEpisodes = gatherEpisodesFromCard(card, true);
    expect(gatheredEpisodes.length).toBeGreaterThan(1);
  });
});

