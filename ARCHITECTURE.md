# Project Architecture Reference

This guide complements `ADAPTERS.md` by documenting the frontend and the rest of the system.

## Frontend (Next.js App Router)

- Entry page: `src/app/page.tsx`
- Page support modules:
  - `src/app/page.constants.ts`
  - `src/app/page.helpers.ts`
  - `src/app/page.types.ts`
- Home domain hooks:
  - `src/app/hooks/useBriefEditor.ts`
  - `src/app/hooks/useAssetComposer.ts`
  - `src/app/hooks/useBriefChat.ts`
  - `src/app/hooks/useGenerationRun.ts`
  - `src/app/hooks/useContextLibrary.ts`
- Home UI components:
  - `src/app/components/home/SidebarPanel.tsx`
  - `src/app/components/home/ChatTimeline.tsx`
  - `src/app/components/home/ChatComposer.tsx`
  - `src/app/components/home/RunCard.tsx`
  - `src/app/components/home/RunSummaryCard.tsx`
- App shell:
  - `src/app/layout.tsx`
  - `src/app/globals.css`

## API Layer

- `src/app/api/generate/route.ts`
  - Main campaign generation endpoint.
- `src/app/api/brief-chat/route.ts`
  - Brief drafting / chat endpoint.
- `src/app/api/context/route.ts`
  - Context library list/read/save endpoint with path and file safety checks.
- `src/app/api/download/[campaignId]/route.ts`
  - Campaign output ZIP/download endpoint.
- `src/app/api/_shared/*`
  - Shared API helpers and route utilities.

## Orchestration and Core Flow

- `src/pipeline/orchestrator.ts`
  - Coordinates full run: validation, retrieval, generation, composition, compliance, persistence.
- `src/pipeline/types.ts`
  - Pipeline DTOs and reporting contracts.
- `src/domain/campaignBrief.ts`
  - Campaign brief domain model/schema boundary.

## Retrieval (RAG-Lite)

- `src/rag/indexer.ts`
  - Builds/loads chunked local context index.
- `src/rag/retriever.ts`
  - Retrieves ranked context snippets used in prompts.

## Services (Business Logic)

- `src/services/assetService.ts`
  - Asset ingestion, matching, and metadata/semantic handling.
- `src/services/promptBuilder.ts`
  - Prompt assembly with campaign + retrieved context.
- `src/services/creativeComposer.ts`
  - Creative resizing/compositing and text placement.
- `src/services/brandCompliance.ts`
  - Compliance checks and publish-readiness flags.
- `src/services/outputWriter.ts`
  - Writes generated outputs and run reports.

## Adapter Layer

- See `ADAPTERS.md` for adapter and utility module details.
- Key files live under `src/adapters/*`.

## Data and Artifacts

- Input context corpus: `context/brand/*`, `context/market/*`
- Sample brief: `examples/brief.sample.json`
- Generated artifacts: `outputs/<campaignId>/*`
- Report artifact: `outputs/<campaignId>/run-report.json`

## Runtime Flow (High-Level)

1. UI submits brief/assets to API.
2. API invokes pipeline orchestrator.
3. Orchestrator retrieves context (RAG), builds prompts, calls adapters/services.
4. Composer generates creative variants and compliance checks run.
5. Outputs + `run-report.json` are written and returned to UI.