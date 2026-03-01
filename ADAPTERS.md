# Adapters Reference

This file documents the adapter layer and related utility/type modules.

## Shared Types

- `src/adapters/adapterTypes.ts`
- Purpose: Central source of adapter DTOs and shared unions.
- Contains:
  - `GenerationSource`
  - OpenAI DTOs (`GeneratedCopyDto`, `GeneratedImageDto`, `GeneratedRunSummaryDto`)
  - Image semantic DTOs (`AssetRoleDto`, `ImageSemanticInputDto`, `ImageSemanticAnalysisDto`, `LiveVisionPayload`)
  - Web search DTOs (`WebSearchSnippet`, `WebSearchResultItem`, `WebSearchResponsePayload`)

## OpenAI Adapter

- `src/adapters/openaiClient.ts`
- Purpose: Orchestrates text/image/run-summary generation with OpenAI and fallback behavior.
- Public API:
  - `isMockMode()`
  - `generateCopy(prompt, model?)`
  - `generateImage(prompt)`
  - `generateRunSummary(prompt, fallbackText, model?)`

### OpenAI Utilities

- `src/adapters/openaiUtils.ts`
- Purpose: Keep `openaiClient` focused by extracting helper logic.
- Exports:
  - `formatOpenAIErrorMessage(error, operation)`
  - `buildOpenAIPlaceholderImage(label)`

## Image Semantic Adapter

- `src/adapters/imageSemanticClient.ts`
- Purpose: Orchestrates semantic image analysis with deterministic heuristic fallback and optional live vision enhancement.
- Public API:
  - `analyzeImage(input)`

### Image Semantic Utilities

- `src/adapters/imageSemanticUtils.ts`
- Purpose: Encapsulate image semantic parsing/heuristics and payload merge logic.
- Exports:
  - `tokenizeImageName(input)`
  - `buildImageSemanticHeuristic(tokens, reason)`
  - `parseImageSemanticLiveVisionPayload(input)`
  - `mergeImageSemanticLiveVisionResult(payload, heuristic)`

## Web Search Adapter

- `src/adapters/webSearchClient.ts`
- Purpose: Executes optional web search via OpenAI web-search tool and returns normalized snippets.
- Public API:
  - `search(query, maxResults?)`

## Conventions

- Keep adapter classes orchestration-focused.
- Move parsing, normalization, formatting, and mapping helpers into `*Utils.ts` modules.
- Add/extend DTOs in `adapterTypes.ts` instead of redefining inline types in client files.
- Prefer deterministic fallback behavior when external calls fail.
