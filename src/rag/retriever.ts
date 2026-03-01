import { RagChunk, RagIndex } from "./indexer";

export type RagMatch = {
  source: string;
  text: string;
  score: number;
  signals?: {
    mode: RetrievalMode;
    lexical: number;
    semantic: number;
    phrase: number;
    density: number;
    intent: number;
  };
};

export type RetrievalMode = "lexical" | "semantic" | "hybrid";

export type RetrievalMetadataFilters = {
  region?: string;
  country?: string;
  language?: string;
  productId?: string;
  productName?: string;
  terms?: string[];
};

export type RetrieveContextOptions = {
  topK?: number;
  mode?: RetrievalMode;
  sourceTypes?: Array<"brand" | "market" | "other">;
  metadata?: RetrievalMetadataFilters;
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

function normalizeOptional(input: string | undefined): string | null {
  if (!input) {
    return null;
  }
  const value = normalizeText(input).trim();
  return value.length > 0 ? value : null;
}

function toNormalizedTerms(input: string | undefined): string[] {
  if (!input) {
    return [];
  }
  return normalizeText(input)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function getMetadataMinMatches(totalTerms: number): number {
  const fallback = totalTerms >= 3 ? 2 : 1;
  const raw = process.env.RAG_METADATA_FILTER_MIN_MATCHES;
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), Math.max(totalTerms, 1));
}

function matchesMetadata(
  chunk: RagChunk,
  metadata: RetrievalMetadataFilters | undefined,
  sourceTypes: Array<"brand" | "market" | "other"> | undefined,
): boolean {
  if (!metadata) {
    return true;
  }

  const sourceType = classifySource(chunk.source);
  if (sourceTypes && sourceTypes.length > 0 && !sourceTypes.includes(sourceType)) {
    return false;
  }

  const region = normalizeOptional(metadata.region);
  const country = normalizeOptional(metadata.country);
  const language = normalizeOptional(metadata.language);
  const productId = normalizeOptional(metadata.productId);
  const productName = normalizeOptional(metadata.productName);
  const terms = (metadata.terms ?? []).flatMap((term) => toNormalizedTerms(term));

  const marketTerms = [
    ...toNormalizedTerms(region ?? undefined),
    ...toNormalizedTerms(country ?? undefined),
    ...toNormalizedTerms(language ?? undefined),
  ];

  if (marketTerms.length > 0 && sourceType === "market") {
    const sourceText = `${normalizeText(chunk.source)} ${normalizeText(chunk.text)}`;
    const marketMatchCount = marketTerms.reduce(
      (count, term) => (sourceText.includes(term) ? count + 1 : count),
      0,
    );
    if (marketMatchCount === 0) {
      return false;
    }
  }

  const allTerms = [
    ...marketTerms,
    ...toNormalizedTerms(productId ?? undefined),
    ...toNormalizedTerms(productName ?? undefined),
    ...terms,
  ];

  if (allTerms.length === 0) {
    return true;
  }

  const haystack = `${normalizeText(chunk.source)} ${normalizeText(chunk.text)}`;
  const uniqueTerms = Array.from(new Set(allTerms));
  const matchedTermCount = uniqueTerms.reduce(
    (count, term) => (haystack.includes(term) ? count + 1 : count),
    0,
  );
  const minimumMatches = getMetadataMinMatches(uniqueTerms.length);
  return matchedTermCount >= minimumMatches;
}

function getModeFromEnv(): RetrievalMode {
  const value = process.env.RAG_RETRIEVAL_MODE?.trim().toLowerCase();
  if (value === "lexical" || value === "semantic" || value === "hybrid") {
    return value;
  }
  return "hybrid";
}

function getWeightFromEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function toTokenCounts(tokens: string[]): Map<string, number> {
  const tokenCounts = new Map<string, number>();
  for (const token of tokens) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }
  return tokenCounts;
}

function normalizeByMax(value: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) {
    return 0;
  }
  return value / max;
}

function buildSemanticTokenSet(tokens: string[]): Set<string> {
  const expanded = new Set<string>(tokens);
  const semanticGroups: string[][] = [
    ["audience", "segment", "consumer", "customer"],
    ["brand", "voice", "tone", "identity"],
    ["market", "region", "country", "locale"],
    ["compliance", "policy", "legal", "forbidden"],
    ["logo", "mark", "badge", "symbol"],
    ["color", "palette", "hue", "shade"],
  ];

  for (const group of semanticGroups) {
    if (group.some((word) => expanded.has(word))) {
      for (const word of group) {
        expanded.add(word);
      }
    }
  }

  return expanded;
}

function jaccardSimilarity(queryTerms: Set<string>, chunkTerms: Set<string>): number {
  if (queryTerms.size === 0 || chunkTerms.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const term of queryTerms) {
    if (chunkTerms.has(term)) {
      overlap += 1;
    }
  }

  const union = queryTerms.size + chunkTerms.size - overlap;
  if (union <= 0) {
    return 0;
  }

  return overlap / union;
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
  return retrieveContextWithOptions(index, query, { topK });
}

export function retrieveContextWithOptions(
  index: RagIndex,
  query: string,
  options: RetrieveContextOptions = {},
): RagMatch[] {
  const topK = options.topK ?? 4;
  const mode = options.mode ?? getModeFromEnv();
  const queryTokens = toTokens(query);
  const queryTokenCounts = toTokenCounts(queryTokens);
  const queryText = normalizeText(query).trim();
  const lexicalWeight = getWeightFromEnv("RAG_HYBRID_LEXICAL_WEIGHT", 0.65);
  const semanticWeight = getWeightFromEnv("RAG_HYBRID_SEMANTIC_WEIGHT", 0.35);

  const wantsBrand = queryTokens.some((token) =>
    ["brand", "voice", "logo", "color", "colors", "forbidden", "compliance"].includes(token),
  );
  const wantsMarket = queryTokens.some((token) =>
    ["market", "audience", "region", "country", "language", "latam"].includes(token),
  );

  if (queryTokens.length === 0) {
    return [];
  }

  const chunksAfterMetadata = index.chunks.filter((chunk) =>
    matchesMetadata(chunk, options.metadata, options.sourceTypes),
  );
  const candidateChunks = chunksAfterMetadata.length > 0 ? chunksAfterMetadata : index.chunks;

  const documentCount = Math.max(candidateChunks.length, 1);
  const averageDocumentLength =
    candidateChunks.length > 0
      ? candidateChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / candidateChunks.length
      : 1;

  const tokenDocumentFrequency = new Map<string, number>();
  for (const token of queryTokens) {
    let count = 0;
    for (const chunk of candidateChunks) {
      if (chunk.tokens.has(token)) {
        count += 1;
      }
    }
    tokenDocumentFrequency.set(token, count);
  }

  const querySemanticTerms = buildSemanticTokenSet(queryTokens);
  const k1 = 1.5;
  const b = 0.75;

  const ranked = candidateChunks
    .map((chunk) => {
      let bm25Score = 0;
      let overlapCount = 0;

      for (const token of queryTokens) {
        const tf = chunk.tokenCounts.get(token) ?? 0;
        if (tf > 0) {
          overlapCount += 1;
          const df = tokenDocumentFrequency.get(token) ?? 0;
          const idf = Math.log((documentCount + 1) / (df + 1)) + 1;
          const normalizedTf =
            (tf * (k1 + 1)) /
            (tf + k1 * (1 - b + b * (chunk.tokenCount / Math.max(averageDocumentLength, 1))));
          const queryBoost = 1 + Math.log((queryTokenCounts.get(token) ?? 1) + 1) * 0.2;
          bm25Score += idf * normalizedTf * queryBoost;
        }
      }

      const normalizedChunkText = normalizeText(chunk.text);
      const phraseBoost = queryText.length > 0 && normalizedChunkText.includes(queryText) ? 2 : 0;
      const densityBoost = queryTokens.length > 0 ? overlapCount / queryTokens.length : 0;
      const intentBoost = sourceIntentBoost(queryTokens, chunk.source);

      const chunkSemanticTerms = buildSemanticTokenSet(Array.from(chunk.tokens));
      const semanticScore = jaccardSimilarity(querySemanticTerms, chunkSemanticTerms);

      const lexicalSignal = bm25Score + phraseBoost + densityBoost;
      const lexicalScore = mode === "semantic" ? 0 : lexicalSignal;
      const semanticSignal = mode === "lexical" ? 0 : semanticScore;

      return {
        source: chunk.source,
        text: chunk.text,
        lexicalScore,
        semanticScore: semanticSignal,
        intentBoost,
        phraseBoost,
        densityBoost,
        overlapCount,
      };
    })
    .filter((result) => result.overlapCount > 0 || (mode !== "lexical" && result.semanticScore > 0));

  const maxLexicalScore = Math.max(...ranked.map((result) => result.lexicalScore), 0);
  const maxSemanticScore = Math.max(...ranked.map((result) => result.semanticScore), 0);

  const rankedWithHybridScore = ranked
    .map((result) => {
      const lexicalNormalized = normalizeByMax(result.lexicalScore, maxLexicalScore);
      const semanticNormalized = normalizeByMax(result.semanticScore, maxSemanticScore);

      let fusedScore = 0;
      if (mode === "lexical") {
        fusedScore = lexicalNormalized;
      } else if (mode === "semantic") {
        fusedScore = semanticNormalized;
      } else {
        const totalWeight = lexicalWeight + semanticWeight;
        const lexicalPortion = totalWeight > 0 ? lexicalWeight / totalWeight : 0.5;
        const semanticPortion = totalWeight > 0 ? semanticWeight / totalWeight : 0.5;
        fusedScore = lexicalNormalized * lexicalPortion + semanticNormalized * semanticPortion;
      }

      const score = fusedScore + result.intentBoost;

      return {
        ...result,
        score,
        lexicalNormalized,
        semanticNormalized,
      };
    })
    .sort((a, b) => b.score - a.score);

  const selected: Array<{
    source: string;
    text: string;
    score: number;
    lexicalNormalized: number;
    semanticNormalized: number;
    phraseBoost: number;
    densityBoost: number;
    intentBoost: number;
  }> = [];

  if (topK > 1 && wantsBrand) {
    const bestBrand = rankedWithHybridScore.find((item) => classifySource(item.source) === "brand");
    if (bestBrand) {
      selected.push(bestBrand);
    }
  }

  if (topK > 1 && wantsMarket) {
    const bestMarket = rankedWithHybridScore.find(
      (item) => classifySource(item.source) === "market" && !selected.includes(item),
    );
    if (bestMarket) {
      selected.push(bestMarket);
    }
  }

  for (const candidate of rankedWithHybridScore) {
    if (selected.length >= topK) {
      break;
    }
    if (!selected.includes(candidate)) {
      selected.push(candidate);
    }
  }

  return selected.map(
    ({
      source,
      text,
      score,
      lexicalNormalized,
      semanticNormalized,
      phraseBoost,
      densityBoost,
      intentBoost,
    }) => ({
    source,
    text,
    score: Number(score.toFixed(3)),
      signals: {
        mode,
        lexical: Number(lexicalNormalized.toFixed(3)),
        semantic: Number(semanticNormalized.toFixed(3)),
        phrase: Number(phraseBoost.toFixed(3)),
        density: Number(densityBoost.toFixed(3)),
        intent: Number(intentBoost.toFixed(3)),
      },
    }),
  );
}
