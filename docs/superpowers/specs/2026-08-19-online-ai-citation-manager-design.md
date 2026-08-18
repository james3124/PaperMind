# Online AI + Citation Manager — Design

**Date:** 2026-08-19
**Status:** Approved by user (sections 1–5)

## Summary

PaperMind gains two capabilities:

1. **Cloud AI writing** — the 19-stage pipeline can run on any OpenAI-compatible
   chat endpoint (user-configurable base URL, API key, model) instead of the
   on-device Qwen model. On-device inference remains as a fallback.
2. **Structured citation management** — the sources a paper was written from are
   stored as structured metadata. The user can pick which literature sources to
   query, review the papers before writing, and after writing replace any
   individual citation from the editor. Swapping a citation updates the in-text
   marker and the References section automatically and deterministically (no
   LLM round-trip).

## Architecture

New files:

| File | Responsibility |
|---|---|
| `src/services/inference.ts` | Provider router — dispatches `complete`/`stream` to local llama or cloud based on settings + connectivity |
| `src/services/cloudService.ts` | OpenAI-compatible `/chat/completions` client, SSE streaming, `testConnection()` |
| `src/services/citationFormat.ts` | Deterministic `formatReference(paper, style, edition, index)` and `formatMarker(paper, style, index)` for all 6 styles × editions |
| `src/services/referencesService.ts` | Builds/regenerates the References section from `sourcesJson` + style/edition; single-entry swap |

Changed files:

| File | Change |
|---|---|
| `src/db/models/Document.ts` | Add `sourcesJson` field (JSON array of `SourcePaper`; array position = citation index) |
| `src/db/migrations/index.ts` | Add migration v2 adding `sourcesJson` |
| `src/stores/settingsStore.ts` | Add `provider: 'local' \| 'cloud'`, `cloudBaseUrl`, `cloudApiKey`, `cloudModel`, fallback toggle — persisted via existing AsyncStorage pattern |
| `src/services/literatureSearch.ts` | `searchLiterature(topic, questions, enabledSources)` — skips disabled sources; default all four |
| `src/services/pipelineService.ts` | Provider-agnostic (calls `inference.ts`); prompts list each source with its exact marker string; "Compiling references" stage no longer asks LLM for references blob |
| `src/screens/GenerateScreen.tsx` | New "Sources" step: 4 source toggles + search & review paper list (remove/reorder/search again) |
| `src/screens/EditorScreen.tsx` | "Citations" toolbar button → CitationManagerModal |
| `src/screens/SettingsScreen.tsx` | AI Provider section: radio (On-device/Cloud), base URL, API key (password field), model name, Test connection |
| `src/components/editor/EditorWebView.tsx` | New `replaceCitationMarkers(index, oldMarker, newMarker)` command; references-section locate flow |
| `src/db/DocumentRepository.ts` | `updateSources(id, sources)` |
| New components | `CitationManagerModal`, `CitationPickerModal`, source toggle chips |

## Data model

`Document.sourcesJson` — JSON string of `SourcePaper[]` (`{title, authors, year, abstract, doi?, url?, source}`). Array position is the citation index `[n]`. Empty/parse-failure treated as empty list with a "regenerate references" hint, never a crash.

Migration v2: `ALTER TABLE documents ADD COLUMN sources_json TEXT`.

## Cloud AI provider

- `cloudService.completeCloud(messages, {temperature, maxTokens, onToken?})`:
  POST `{baseUrl}/chat/completions` with `stream: true`; parse SSE `data:` lines
  incrementally, accumulate `choices[0].delta.content`; non-streaming fallback
  on SSE failure; 30s timeout.
- Messages `{role, content}` — same shape as `llamaService.CompletionMessage`,
  so `pipelineService` prompt builders are reused unchanged.
- `testConnection()` — minimal request, returns `{ok, latencyMs, error?}`.
- Router: `resolveProvider()` → `'cloud'` if provider = cloud, configured, and
  connectivity passes; otherwise `'local'`. Connectivity check: attempt the
  request directly; on network failure, fall back to local for that call.
  Pipeline calls `complete`/`stream` through `inference.ts` only.
- API key lives only in AsyncStorage (existing persisted-settings pattern).
  Never logged, never bundled, never committed.

## Generation flow

1. New "Sources" step: 4 toggles (CrossRef, OpenAlex, Semantic Scholar, arXiv),
   at least one enabled; toggle state persisted in the settings store
   (AsyncStorage, existing pattern).
2. "Search & review papers": ranked list with source badges; remove rows;
   "Search again"; "Add more" with refined query.
3. Selected list shows citation indices `[1] [2] …`; reorderable to control
   numbering.
4. Selected papers → `sourcesJson`. Pipeline prompt lists each source with its
   exact marker string (e.g. `[1] → (Smith, 2020)`) and requires verbatim use —
   markers become machine-findable.
5. References section generated deterministically by `referencesService`, not
   by the LLM.

## Editor citation manager

- Toolbar "Citations" → CitationManagerModal: sources with index, formatted
  marker, formatted reference (live preview).
- "Replace" → CitationPickerModal: search field + same 4 source toggles,
  results deduped/ranked, current paper excluded. Works offline from cached
  last results.
- Swap: (1) `updateSources`; (2) exact replace of `formatMarker(old)` →
  `formatMarker(new)` at every occurrence for that index via
  `replaceCitationMarkers`; (3) `referencesService.regenerateReferences`
  rebuilds References section, section located via existing heading scan.
- Word count and DOCX export update automatically (read document content).

## Error handling

- Cloud timeout/unreachable/non-200 → inline error on progress screen with
  Retry and "Use on-device model instead" fallback.
- SSE parse failure → one automatic non-streaming retry, then error surfaced.
- Literature source failure → existing `allSettled` graceful degradation.
- Zero sources enabled → cannot proceed.
- Offline swap → cached results; deterministic regeneration still works.

## Testing

- `citationFormat.test.ts` — golden tests: APA 7th, MLA 9th, IEEE, Chicago
  17th, Harvard, Vancouver; author-date vs numeric markers; et-al/missing-author
  edges.
- `referencesService.test.ts` — section regeneration; single-entry swap keeps
  other entries byte-identical; out-of-range index.
- `literatureSearch.test.ts` — `enabledSources` filtering.
- `cloudService.test.ts` — SSE fixture parsing; error mapping; token order.
- `inference.test.ts` — routing: cloud online → cloud; unconfigured → local;
  fallback toggle.
- `DocumentRepository.test.ts` — `updateSources` + migration v2.
- `EditorWebView` bridge — `replaceCitationMarkers` serialization.