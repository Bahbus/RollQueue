let sequence = 0;

function nextId() {
  sequence += 1;
  return sequence;
}

export function episodeFactory(overrides = {}) {
  const id = overrides.id ?? nextId();
  const publishedAt = overrides.publishedAt ?? new Date().toISOString();
  const {
    metadata: metadataOverrides = {},
    ...restOverrides
  } = overrides;
  const normalizedMetadataOverrides =
    metadataOverrides && typeof metadataOverrides === "object" ? metadataOverrides : {};

  const metadataDefaults = {
    seriesTitle: `Series ${Math.ceil(id / 10)}`,
    seasonTitle: `Season ${Math.ceil(id / 5)}`,
    seasonNumber: 1,
    episodeNumber: id
  };

  const defaults = {
    id,
    guid: `episode-${id}`,
    title: `Episode ${id}`,
    subtitle: `Subtitle for episode ${id}`,
    description: "An example episode used for testing.",
    audioUrl: `https://example.com/audio-${id}.mp3`,
    url: `https://example.com/watch/${id}`,
    thumbnail: `https://example.com/thumb-${id}.jpg`,
    audioLanguage: null,
    publishedAt,
    duration: 60 * 30,
    metadata: { ...metadataDefaults, ...normalizedMetadataOverrides }
  };

  return { ...defaults, ...restOverrides };
}

export function resetEpisodeFactory() {
  sequence = 0;
}
