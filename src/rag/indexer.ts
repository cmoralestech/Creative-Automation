import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type RagChunk = {
  id: string;
  source: string;
  text: string;
  tokens: Set<string>;
  tokenCounts: Map<string, number>;
  tokenCount: number;
};

export type RagIndex = {
  chunks: RagChunk[];
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

function tokenize(input: string): {
  tokens: Set<string>;
  tokenCounts: Map<string, number>;
  tokenCount: number;
} {
  const parts = normalizeText(input)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  const tokenCounts = new Map<string, number>();
  for (const token of parts) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }

  return {
    tokens: new Set(parts),
    tokenCounts,
    tokenCount: parts.length,
  };
}

function chunkText(source: string, text: string): RagChunk[] {
  const segments = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return [];
  }

  const windows: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const current = segments[index];
    const next = segments[index + 1];
    if (next) {
      const merged = `${current}\n\n${next}`.trim();
      if (merged.length <= 1400) {
        windows.push(merged);
      } else {
        windows.push(current);
      }
    } else {
      windows.push(current);
    }
  }

  return windows
    .filter((segment) => segment.length >= 40)
    .map((segment, index) => {
      const tokenized = tokenize(segment);
      return {
        id: `${path.basename(source)}:${index}`,
        source,
        text: segment,
        tokens: tokenized.tokens,
        tokenCounts: tokenized.tokenCounts,
        tokenCount: tokenized.tokenCount,
      };
    });
}

async function loadFiles(rootDir: string): Promise<string[]> {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .filter((entry) => /\.(md|txt|json)$/i.test(entry.name))
      .map((entry) => path.join(rootDir, entry.name));
  } catch {
    return [];
  }
}

export async function buildRagIndex(contextDirectories: string[]): Promise<RagIndex> {
  const chunks: RagChunk[] = [];

  for (const dirPath of contextDirectories) {
    const files = await loadFiles(dirPath);
    for (const filePath of files) {
      const content = await readFile(filePath, "utf-8");
      const normalized = filePath.endsWith(".json")
        ? JSON.stringify(JSON.parse(content), null, 2)
        : content;
      chunks.push(...chunkText(filePath, normalized));
    }
  }

  return { chunks };
}
