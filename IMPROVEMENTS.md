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

## Interview Presentation Notes
- Lead with the end-to-end architecture and the two-step brief drafting/generation UX.
- Call out trust/compliance visibility as a governance differentiator.
- Show how outputs and `run-report.json` support review workflows at scale.
