import { describe, expect, it, beforeEach } from "vitest";
import {
  annotateEpisodeCards,
  injectMenuItems,
  gatherEpisodesFromCard,
  MENU_ITEM_ATTRIBUTE,
  MESSAGE_TYPES
} from "../../src/content.js";
import { renderEpisodeCards, clearDom } from "./dom.fixtures.js";
import { describeMenuAction } from "../support/templates.js";

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

  describeMenuAction({
    name: "menu action dispatch",
    beforeEach: () => {
      clearDom();
      globalThis.browser.runtime.sendMessage.mockClear();
    },
    afterEach: () => {
      clearDom();
      globalThis.browser.runtime.sendMessage.mockClear();
    },
    scenarios: [
      {
        description: "queues a single episode when the add action is clicked",
        setup: () => {
          const { cards, menus } = renderEpisodeCards();
          annotateEpisodeCards();
          const menu = menus[0];
          injectMenuItems(menu);
          const items = menu.querySelectorAll(`[${MENU_ITEM_ATTRIBUTE}] button`);
          return { cards, menu, items };
        },
        act: async ({ items }) => {
          expect(items.length).toBe(2);
          items[0].click();
          await Promise.resolve();
        },
        expectedBrowserCalls: [
          {
            api: "runtime.sendMessage",
            matcher: ({ callArgs, context }) => {
              const [message] = callArgs;
              expect(message).toMatchObject({
                type: MESSAGE_TYPES.ADD_EPISODE,
                payload: expect.objectContaining({
                  id: context.cards[0].getAttribute("data-rollqueue-episode-id"),
                  title: context.cards[0].getAttribute("data-rollqueue-episode-title")
                })
              });
            }
          }
        ]
      },
      {
        description: "queues newer episodes when the multi-add action is clicked",
        setup: () => {
          const { cards, menus } = renderEpisodeCards();
          annotateEpisodeCards();
          const menu = menus[0];
          const card = cards[0];
          injectMenuItems(menu);
          const items = menu.querySelectorAll(`[${MENU_ITEM_ATTRIBUTE}] button`);
          return { cards, card, menu, items };
        },
        act: async ({ items }) => {
          expect(items.length).toBe(2);
          items[1].click();
          await Promise.resolve();
        },
        expectedBrowserCalls: [
          {
            api: "runtime.sendMessage",
            matcher: ({ callArgs, context }) => {
              const [message] = callArgs;
              expect(message.type).toBe(MESSAGE_TYPES.ADD_EPISODE_AND_NEWER);
              expect(Array.isArray(message.payload)).toBe(true);
              const ids = message.payload.map((episode) => episode.id);
              expect(ids).toContain(context.card.getAttribute("data-rollqueue-episode-id"));
            }
          }
        ],
        assert: ({ card }) => {
          const gatheredEpisodes = gatherEpisodesFromCard(card, true);
          expect(gatheredEpisodes.length).toBeGreaterThan(1);
        }
      }
    ]
  });
});

