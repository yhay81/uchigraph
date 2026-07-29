const graphemeSegmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

export const countGraphemes = (value: string) =>
  Array.from(graphemeSegmenter.segment(value)).length;
