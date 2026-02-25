import { RagIndex } from "./indexer";

export type RagMatch = {
  source: string;
  text: string;
  score: number;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "you",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "not",
  "but",
  "can",
  "will",
  "all",
  "any",
  "our",
  "its",
  "use",
  "used",
  "using",
  "about",
  "over",
  "under",
  "more",
  "most",
  "very",
  "just",
  "also",
  "they",
  "them",
  "their",
  "then",
  "than",
  "when",
  "where",
  "what",
  "which",
  "who",
]);

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function toTokens(input: string): string[] {
  return normalizeText(input)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function sourceIntentBoost(queryTokens: string[], source: string): number {
  const normalizedSource = source.toLowerCase();
  const wantsBrand = queryTokens.some((token) =>
    ["brand", "voice", "logo", "color", "colors", "forbidden", "compliance"].includes(token),
  );
  const wantsMarket = queryTokens.some((token) =>
    ["market", "audience", "region", "country", "language", "latam"].includes(token),
  );

  if (wantsBrand && normalizedSource.includes("/brand/")) {
    return 0.75;
  }

  if (wantsMarket && normalizedSource.includes("/market/")) {
    return 0.75;
  }

  return 0;
}

function classifySource(source: string): "brand" | "market" | "other" {
  const normalizedSource = source.toLowerCase();
  if (normalizedSource.includes("/brand/")) {
    return "brand";
  }
  if (normalizedSource.includes("/market/")) {
    return "market";
  }
  return "other";
}

export function retrieveContext(index: RagIndex, query: string, topK = 4): RagMatch[] {
  const queryTokens = toTokens(query);
  const queryText = normalizeText(query).trim();
  const wantsBrand = queryTokens.some((token) =>
    ["brand", "voice", "logo", "color", "colors", "forbidden", "compliance"].includes(token),
  );
  const wantsMarket = queryTokens.some((token) =>
    ["market", "audience", "region", "country", "language", "latam"].includes(token),
  );

  if (queryTokens.length === 0) {
    return [];
  }

  const documentCount = Math.max(index.chunks.length, 1);
  const tokenDocumentFrequency = new Map<string, number>();
  for (const token of queryTokens) {
    let count = 0;
    for (const chunk of index.chunks) {
      if (chunk.tokens.has(token)) {
        count += 1;
      }
    }
    tokenDocumentFrequency.set(token, count);
  }

  const ranked = index.chunks
    .map((chunk) => {
      let weightedOverlap = 0;
      let overlapCount = 0;
      for (const token of queryTokens) {
        if (chunk.tokens.has(token)) {
          overlapCount += 1;
          const df = tokenDocumentFrequency.get(token) ?? 0;
          const idf = Math.log((documentCount + 1) / (df + 1)) + 1;
          weightedOverlap += idf;
        }
      }

      const normalizedChunkText = normalizeText(chunk.text);
      const phraseBoost = queryText.length > 0 && normalizedChunkText.includes(queryText) ? 2 : 0;
      const densityBoost = queryTokens.length > 0 ? overlapCount / queryTokens.length : 0;
      const intentBoost = sourceIntentBoost(queryTokens, chunk.source);
      const score = weightedOverlap + phraseBoost + densityBoost + intentBoost;

      return { source: chunk.source, text: chunk.text, score, overlapCount };
    })
    .filter((result) => result.overlapCount > 0)
    .sort((a, b) => b.score - a.score);

  const selected: Array<{ source: string; text: string; score: number; overlapCount: number }> = [];

  if (topK > 1 && wantsBrand) {
    const bestBrand = ranked.find((item) => classifySource(item.source) === "brand");
    if (bestBrand) {
      selected.push(bestBrand);
    }
  }

  if (topK > 1 && wantsMarket) {
    const bestMarket = ranked.find(
      (item) => classifySource(item.source) === "market" && !selected.includes(item),
    );
    if (bestMarket) {
      selected.push(bestMarket);
    }
  }

  for (const candidate of ranked) {
    if (selected.length >= topK) {
      break;
    }
    if (!selected.includes(candidate)) {
      selected.push(candidate);
    }
  }

  return selected.map(({ source, text, score }) => ({
    source,
    text,
    score: Number(score.toFixed(3)),
  }));
}
