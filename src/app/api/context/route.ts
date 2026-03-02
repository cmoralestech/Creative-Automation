import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const CONTEXT_ROOT = path.resolve(process.cwd(), "context");
const ALLOWED_GROUPS = new Set(["brand", "market"]);
const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".json"]);
const MAX_CONTEXT_FILE_BYTES = 150_000;

type ContextListItem = {
  path: string;
  name: string;
  group: "brand" | "market";
};

function toPosixPath(input: string): string {
  return input.split(path.sep).join("/");
}

function hasAllowedExtension(filePath: string): boolean {
  return ALLOWED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isAllowedGroup(relativePath: string): relativePath is `brand/${string}` | `market/${string}` {
  const [group] = relativePath.split("/");
  return Boolean(group && ALLOWED_GROUPS.has(group));
}

function resolveContextPath(rawRelativePath: string): string {
  const trimmed = rawRelativePath.trim();
  if (!trimmed) {
    throw new Error("Missing context file path.");
  }

  const normalizedRelative = path.normalize(trimmed).replace(/^\/+/, "");
  const absolute = path.resolve(CONTEXT_ROOT, normalizedRelative);

  if (!absolute.startsWith(`${CONTEXT_ROOT}${path.sep}`)) {
    throw new Error("Invalid context file path.");
  }

  const relative = toPosixPath(path.relative(CONTEXT_ROOT, absolute));
  if (!isAllowedGroup(relative)) {
    throw new Error("Only context/brand and context/market files are editable.");
  }

  if (!hasAllowedExtension(absolute)) {
    throw new Error("Unsupported file type. Allowed: .md, .txt, .json");
  }

  return absolute;
}

async function listContextFiles(rootDir: string): Promise<string[]> {
  const output: string[] = [];
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await listContextFiles(absolute)));
      continue;
    }

    if (!entry.isFile() || !hasAllowedExtension(absolute)) {
      continue;
    }

    const relative = toPosixPath(path.relative(CONTEXT_ROOT, absolute));
    if (isAllowedGroup(relative)) {
      output.push(relative);
    }
  }

  return output;
}

async function handleList(): Promise<Response> {
  const groupedItems: ContextListItem[] = [];

  for (const group of ALLOWED_GROUPS) {
    const groupDir = path.join(CONTEXT_ROOT, group);
    try {
      const relativeFiles = await listContextFiles(groupDir);
      for (const relativePath of relativeFiles) {
        const [resolvedGroup] = relativePath.split("/");
        if (resolvedGroup !== "brand" && resolvedGroup !== "market") {
          continue;
        }

        groupedItems.push({
          path: relativePath,
          name: path.basename(relativePath),
          group: resolvedGroup,
        });
      }
    } catch {
      // Skip missing directories to keep endpoint resilient.
    }
  }

  groupedItems.sort((a, b) => a.path.localeCompare(b.path));

  return Response.json({ files: groupedItems });
}

async function handleRead(rawPath: string): Promise<Response> {
  try {
    const absolute = resolveContextPath(rawPath);
    const content = await readFile(absolute, "utf-8");
    return Response.json({ path: toPosixPath(path.relative(CONTEXT_ROOT, absolute)), content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read context file.";
    const status = message.includes("Invalid") || message.includes("Missing") || message.includes("Only") || message.includes("Unsupported") ? 400 : 404;
    return Response.json({ error: message }, { status });
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const requestedPath = url.searchParams.get("path");

  if (!requestedPath) {
    return handleList();
  }

  return handleRead(requestedPath);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { path?: string; content?: string };
    if (typeof body.path !== "string") {
      return Response.json({ error: "Missing context file path." }, { status: 400 });
    }

    if (typeof body.content !== "string") {
      return Response.json({ error: "Missing context file content." }, { status: 400 });
    }

    if (Buffer.byteLength(body.content, "utf-8") > MAX_CONTEXT_FILE_BYTES) {
      return Response.json(
        { error: `Context file is too large. Maximum size is ${MAX_CONTEXT_FILE_BYTES} bytes.` },
        { status: 400 },
      );
    }

    const absolute = resolveContextPath(body.path);
    await writeFile(absolute, body.content, "utf-8");

    return Response.json({ ok: true, path: toPosixPath(path.relative(CONTEXT_ROOT, absolute)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save context file.";
    const status = message.includes("Invalid") || message.includes("Missing") || message.includes("Only") || message.includes("Unsupported") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
