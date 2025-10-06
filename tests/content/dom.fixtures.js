const DEFAULT_EPISODES = [
  {
    id: "episode-1",
    url: "https://www.crunchyroll.com/watch/episode-1",
    title: "Episode 1",
    subtitle: "Season 1 · Episode 1",
    thumbnail: "https://cdn.crunchyroll.com/thumb-1.jpg"
  },
  {
    id: "episode-2",
    url: "https://www.crunchyroll.com/watch/episode-2",
    title: "Episode 2",
    subtitle: "Season 1 · Episode 2",
    thumbnail: "https://cdn.crunchyroll.com/thumb-2.jpg"
  },
  {
    id: "episode-3",
    url: "https://www.crunchyroll.com/watch/episode-3",
    title: "Episode 3",
    subtitle: "Season 1 · Episode 3",
    thumbnail: "https://cdn.crunchyroll.com/thumb-3.jpg"
  }
];

function createEpisodeCard({ id, url, title, subtitle, thumbnail }) {
  const card = document.createElement("li");
  card.dataset.testid = "episode-card";

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.dataset.testid = "episode-link";

  const thumbnailImg = document.createElement("img");
  thumbnailImg.src = thumbnail;
  thumbnailImg.alt = `${title} thumbnail`;

  const titleEl = document.createElement("h3");
  titleEl.dataset.testid = "media-card-title";
  titleEl.textContent = title;

  const subtitleEl = document.createElement("p");
  subtitleEl.dataset.testid = "media-card-subtitle";
  subtitleEl.textContent = subtitle;

  anchor.append(thumbnailImg, titleEl, subtitleEl);
  card.append(anchor);

  const menu = document.createElement("ul");
  menu.setAttribute("role", "menu");
  const existingItem = document.createElement("li");
  existingItem.textContent = "Existing option";
  menu.append(existingItem);
  card.append(menu);

  return { card, menu };
}

export function renderEpisodeCards(episodes = DEFAULT_EPISODES) {
  document.body.innerHTML = "";
  const list = document.createElement("ul");
  list.dataset.testid = "episode-list";
  const menus = [];
  const cards = episodes.map((episode) => {
    const { card, menu } = createEpisodeCard(episode);
    menus.push(menu);
    list.append(card);
    return card;
  });

  document.body.append(list);

  return { container: list, cards, menus };
}

export function renderEpisodeMenu(card) {
  const menu = document.createElement("ul");
  menu.setAttribute("role", "menu");
  const existingItem = document.createElement("li");
  existingItem.textContent = "Existing option";
  menu.append(existingItem);
  card.append(menu);
  return menu;
}

export function renderAudioMenu({
  options = [
    { label: "English", value: "en-US" },
    { label: "Japanese", value: "ja-JP" }
  ]
} = {}) {
  const container = document.createElement("div");
  container.dataset.testid = "audio-menu-container";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.dataset.testid = "audio-menu-button";
  toggle.setAttribute("aria-label", "Audio");
  toggle.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.dataset.testid = "audio-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    const next = !expanded;
    toggle.setAttribute("aria-expanded", next ? "true" : "false");
    menu.hidden = !next;
  });

  const optionElements = options.map(({ label, value }) => {
    const option = document.createElement("button");
    option.type = "button";
    option.dataset.testid = "audio-menu-option";
    option.dataset.value = value;
    option.setAttribute("role", "menuitemradio");
    option.textContent = label;
    menu.append(option);
    return option;
  });

  container.append(toggle, menu);
  document.body.append(container);

  return { container, toggle, menu, options: optionElements };
}

export function clearDom() {
  document.body.innerHTML = "";
}

