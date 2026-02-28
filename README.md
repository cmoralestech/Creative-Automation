# Creative Automation Pipeline (Adobe FDE POC)

Local web app that demonstrates campaign creative automation for social ads:
- Ingests a **JSON campaign brief**
- Reuses uploaded product assets when available
- Generates missing assets with OpenAI
- Produces output variants for `1:1`, `9:16`, and `16:9`
- Overlays campaign copy
- Runs basic brand compliance checks (logo + color proximity)
- Saves outputs and a `run-report.json`

## Tech Stack
- Next.js + TypeScript + Tailwind CSS
- OpenAI SDK (text + image generation)
- Sharp (image resize/composition)
- Zod (strict JSON schema validation)
- Local file storage for outputs and reports

## Project Structure
- `src/app/page.tsx`: Tailwind UI for brief upload, assets, and run summary
- `src/app/api/generate/route.ts`: API endpoint that runs pipeline
- `src/pipeline/orchestrator.ts`: End-to-end flow coordination
- `src/rag/*`: RAG-lite index + retrieval from local context files
- `src/services/*`: prompting, composition, compliance, output writing
- `context/brand`, `context/market`: local grounding docs
- `examples/brief.sample.json`: ready-to-run sample brief

## Architecture Flow
1. **Ingest** brief + optional assets from UI/API.
2. **Validate** input schema and upload guardrails.
3. **Retrieve** brand/market context via local RAG-lite search.
4. **Generate** copy + missing base images via OpenAI (or mock/fallback).
5. **Compose** aspect-ratio creatives with text and optional logo.
6. **Evaluate** compliance (copy/legal + logo + color).
7. **Persist** outputs and `run-report.json`, then return UI summary.

## Type Naming Convention
- Domain layer (`src/domain/*`) keeps business model names (no DTO suffix required).
- Boundary contracts in adapters/services/API/pipeline use explicit `*Dto` names.
- Source labels and orchestration contracts stay separate from domain entities to keep boundaries clear.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local`:
   ```bash
   OPENAI_API_KEY=your_key_here
   MOCK_MODE=false
   ```
   - If `OPENAI_API_KEY` is missing or `MOCK_MODE=true`, the app runs in mock mode.
3. Start app:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`.

## macOS TLS fix (if OpenAI calls fail with certificate errors)
If you see errors like `unable to get local issuer certificate` or `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, create a local trust bundle and run the trusted dev script:

```bash
mkdir -p certs
security find-certificate -a -p \
  /System/Library/Keychains/SystemRootCertificates.keychain \
  /Library/Keychains/System.keychain > certs/macos-trust-bundle.pem
npm run dev:trusted
```

This keeps TLS verification enabled while letting Node trust your machine's keychain CAs.

## How To Run
1. Paste/upload JSON brief (use `examples/brief.sample.json` as template).
   - The sample is a US sportswear campaign (`spring-sportswear-2026`) with `running-socks` and `tennis-shoes`.
   - Or use **Workspace brief chat** in the main panel to request a campaign in natural language and draft valid JSON.
2. Optionally upload assets:
   - product images (filename should include product id or name)
   - optional `logo` file (filename containing `logo`)
3. Generate creatives:
   - **JSON/Simple flow:** click **Generate** in the left panel.
   - **Brief chat flow (recommended):** send prompt → review drafted JSON in JSON mode → click **Generate from latest draft**.
4. Review run summary in UI.

## Output
Generated files are saved under:
- `outputs/<campaignId>/<productId>/1x1/creative.png`
- `outputs/<campaignId>/<productId>/9x16/creative.png`
- `outputs/<campaignId>/<productId>/16x9/creative.png`
- `outputs/<campaignId>/run-report.json`

Example from the included sample brief:
- `outputs/spring-sportswear-2026/running-socks/1x1/creative.png`
- `outputs/spring-sportswear-2026/tennis-shoes/9x16/creative.png`

From the UI run summary, you can click **Download all outputs (.zip)** to export the full campaign folder.

## RAG-Lite Behavior
- Context is loaded from `context/brand` and `context/market`.
- Files are chunked and retrieved by token overlap with campaign/product query.
- Top snippets are injected into copy and image prompts.
- Retrieval sources/scores are included in the run report.

## Safety and Governance Guardrails
- **Upload guardrails:** API enforces brief size limit, asset count limit, per-file size limit, and allowed image formats.
- **Prompt hardening:** prompts separate trusted policy/campaign fields from untrusted retrieved context and explicitly ignore instructions inside context snippets.
- **Compliance normalization:** copy checks normalize casing, punctuation, and diacritics to better catch obfuscated forbidden words/phrases.
- **Publish gating:** each output includes `publishReady` and `blockedReasons`; UI highlights review-required creatives.
- **Trust transparency:** run results indicate whether copy/image came from `live`, `fallback`, `mock`, or `uploaded` sources.
- **Brief chat contract:** workspace chat only handles campaign-brief generation and validates generated JSON against the campaign schema before applying it.

## Assumptions and Limitations
- Input format is JSON only.
- Compliance checks are heuristics for demo purposes:
  - Logo check validates whether logo was composited when required.
  - Color check compares average image color to brand palette.
  - Legal/copy check flags forbidden words with diacritic normalization to catch obfuscated variants.
- No external vector DB; retrieval is local and lightweight.
- Deep localization (translated copy) is not implemented in this version.

## Demo Tradeoffs and Production Next Steps
- **RAG-lite lexical retrieval (demo):** simple, deterministic, no external infra.
   - **Production:** hybrid retrieval (BM25 + embeddings), metadata filters, freshness/index cache.
- **Local filesystem outputs (demo):** easy local verification and interview setup.
   - **Production:** object storage with signed URLs, tenant isolation, retention policies.
- **Heuristic compliance (demo):** fast baseline checks for logo/color/forbidden phrases.
   - **Production:** policy engine, market-specific legal rules, human approval workflow.
- **Synchronous request flow (demo):** straightforward UX and implementation.
   - **Production:** async jobs/queues, retries, rate limiting, SLA-driven monitoring.

## Suggested 2–3 Minute Demo Script
1. Show JSON brief + uploaded product/logo assets.
2. Show brief-chat drafting a valid brief, then click **Generate from latest draft**.
3. Explain reuse-vs-generate decision and trust source labels in the run results.
4. Open output folders for each product/aspect ratio.
5. Show `run-report.json` with timings, compliance, and retrieved context.

## Interview Submission Checklist
Use this checklist before sending the take-home package:

### Repository
- [ ] Push this project to a **public GitHub repository**.
- [ ] Verify README instructions work end-to-end on a clean machine.
- [ ] Confirm sample run artifacts are present under `outputs/`.

### Demo Video (required)
- [ ] Record a **2–3 minute** walkthrough video.
- [ ] Include: brief input, generation trigger, outputs by ratio, and `run-report.json`.
- [ ] Export/shareable file or link ready for Talent Partner.

### Interview Readiness
- [ ] Prepare a 30-minute walkthrough: architecture, tradeoffs, safeguards, and next steps.
- [ ] Be ready to explain where each required item is implemented in code.
