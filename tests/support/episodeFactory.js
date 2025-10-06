let sequence = 0;

function nextId() {
  sequence += 1;
  return sequence;
}

export function episodeFactory(overrides = {}) {
  const id = overrides.id ?? nextId();

  const defaults = {
    id,
    guid: `episode-${id}`,
    title: `Episode ${id}`,
    description: "An example episode used for testing.",
    audioUrl: `https://example.com/audio-${id}.mp3`,
    publishedAt: new Date().toISOString(),
    duration: 60 * 30
  };

  return { ...defaults, ...overrides };
}

export function resetEpisodeFactory() {
  sequence = 0;
}
