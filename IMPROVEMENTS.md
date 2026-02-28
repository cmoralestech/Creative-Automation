# Creative Automation Pipeline - Current Status and Next Steps

## Completed Improvements

### Pipeline and Reliability
- Products are processed in parallel for faster end-to-end execution.
- Missing assets are generated and then composed into all required ratios.
- Adaptive brand tint retry is applied when color compliance initially fails on generated imagery.
- Trust metadata is returned for copy/image/summary sources (`live`, `mock`, `fallback`, `uploaded`).

### Governance and Safety
- Upload guardrails enforce file count, file size, and image MIME constraints.
- Prompt hardening separates trusted policy fields from untrusted context snippets.
- Copy compliance normalizes punctuation/casing/diacritics to catch obfuscated forbidden words.
- Publish gating is computed per output and surfaced in UI/run report (`publishReady`, `blockedReasons`).

### UX and Developer Experience
- Chat-first workflow with model selector and schema-constrained brief JSON generation.
- Two-step confirmation flow for brief-chat: draft JSON first, then explicit generate action.
- Download-all ZIP export is available from run summary.
- Improved TLS/certificate troubleshooting guidance for macOS local development.

## Open Improvements (Prioritized)

### High Priority
1. Add true backend progress streaming (SSE/WebSocket) instead of timer-based progress text.
2. Add retry/backoff for transient upstream errors (rate limits/network failures).
3. Replace remaining preview `<img>` usage with optimized Next `Image` where applicable.

### Medium Priority
4. Add regenerate-per-output action (single ratio re-run without full campaign rerun).
5. Add optional copy-edit step before final composition.
6. Add prompt/image cache keyed by campaign/product hash to reduce duplicate generation.

### Low Priority
7. Add lightweight metrics dashboard (duration, publish-ready ratio, source mix).
8. Add advanced localization and market-specific policy packs.

## Asset Semantic Extraction & Prompt Enrichment
- Expose semantic extraction results (manual and auto) in `run-report.json` for each generation run. (Pending)
- Gate live semantic extraction and prompt enrichment behind feature flags (env/config) for safe rollout and benchmarking.
- Integrate live image analysis API (OpenAI Vision, Google Vision, etc.) in `imageSemanticClient`, controlled by feature flag.
- Add robust error handling and fallback logic for extraction failures (manual metadata or safe defaults).
- Create benchmark briefs and a QA checklist to validate extraction accuracy and prompt influence.
- Update developer documentation to explain new asset semantic flow, DTOs, and feature flags.

## RAG & Context Retrieval
- Hybrid retrieval is now implemented with BM25 lexical scoring + heuristic semantic similarity.
- Add true embedding retrieval and metadata filters for improved context relevance.
- Add freshness/index cache for context files to support rapid iteration and production scaling.

## Output & Compliance
- Persist extraction details, compliance results, and retrieval sources in `run-report.json` for transparency and debugging.
- Expand compliance checks to support market-specific legal rules and human approval workflow.

## Safety & Governance
- Strengthen feature flag and kill switch coverage for all new semantic and compliance features.
- Document all new guardrails and fallback logic in README and developer docs.

## Demo & Interview Readiness
- Ensure demo script and checklist reflect new semantic extraction and reporting features.
- Prepare sample run artifacts showing extraction details in outputs and reports.

---

# Completed
- Dynamic model selection end-to-end
- Asset metadata UI/API/plumbing
- Prompt visual context injection
- Deterministic mock semantic extraction
- Asset DTO extension and merge logic
- Static checks and build validation
