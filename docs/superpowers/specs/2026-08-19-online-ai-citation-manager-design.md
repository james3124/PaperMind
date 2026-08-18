# Online AI + Citation Manager + Editor Chat — Design

**Date:** 2026-08-19
**Status:** Approved by user (sections 1–5 + chat section 6)

## Summary

PaperMind gains three capabilities:

1. **Cloud AI writing** — the 19-stage pipeline can run on any OpenAI-compatible
   chat endpoint (user-configurable base URL, API key, model) instead of the
   on-device Qwen model. On-device inference remains as a fallback.
2. **Structured citation management** — the sources a paper was written from are
   stored as structured metadata. The user can pick which literature sources to
   query, review the papers before writing, and after writing replace any
   individual citation from the editor. Swapping a citation updates the in-text
   marker and the References section automatically and deterministically (no
   LLM round-trip).
3. **Paper-aware editor chat** — a chat panel in the editor that knows the
   current paper (content + sources). Answers can be applied directly into the
   document at the cursor. History is persisted per paper.

## Architecture

New files:

| File | Responsibility |
|---|---|
| `src/services/inference.ts` | Provider router — dispatches `complete`/`stream` to local llama or cloud based on settings + connectivity |
| `src/services/cloudService.ts` | OpenAI-compatible `/chat/completions` client, SSE streaming, `testConnection()` |
| `src/services/citationFormat.ts` | Deterministic `formatReference(paper, style, edition, index)` and `formatMarker(paper, style, index)` for all 6 styles × editions |
| `src/services/referencesService.ts` | Builds/regenerates the References section from `sourcesJson` + style/edition; single-entry swap |
| `src/services/chatService.ts` | Builds chat system prompt (paper content truncated to max chars + sources), message history helpers, Apply-text extraction |
| `src/components/editor/ChatPanel.tsx` | Slide-in chat panel: message bubbles, streaming tokens, input, Apply button on assistant messages |

Changed files:

| File | Change |
|---|---|
| `src/db/models/Document.ts` | Add `sourcesJson` and `chatJson` fields (JSON strings; array position = citation index) |
| `src/db/migrations/index.ts` | Add migration v2 adding `sources_json` and `chat_json` |
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

`Document.chatJson` — JSON string of `ChatMessage[]` (`{role: 'user' | 'assistant', content, applied: boolean, createdAt}`). Capped at the last 50 messages for context; full history persisted in the field.

Migration v2: `ALTER TABLE documents ADD COLUMN sources_json TEXT; ALTER TABLE documents ADD COLUMN chat_json TEXT;`

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

## Paper-aware editor chat

- **ChatPanel** — slide-in panel in the editor (same pattern as the existing
  OutlinePanel/AiPanel). Message bubbles (user right, assistant left), input
  bar, live token streaming, loading indicator.
- **Paper-aware context** — `chatService.buildSystemPrompt(paper, sources,
  style, edition)`: system prompt contains the paper content truncated to a
  max of 15,000 chars (with a "truncated" note), the selected sources with
  their marker strings, and the citation style. Rebuilt per conversation
  (each turn sends full paper context — bounded by the truncation cap).
- **Streaming** — assistant replies stream through `inference.ts` (cloud SSE
  or local llama), tokens append to the message bubble as they arrive.
- **Apply to paper** — every assistant message has an **Apply** button;
  tapping it inserts the reply text at the cursor via the existing
  `insertText`/`insertDelta` EditorRef commands (markdown → delta via existing
  `markdownToQuillDelta`, plain-text fallback). Applied messages show an
  "applied" badge; content of the paper changes flow into the normal
  `onContentChange` save path.
- **Persistence** — history saved to `Document.chatJson` on every
  user/assistant message; reopened editor restores the conversation. History
  beyond the last 50 messages is trimmed from context but kept in storage.
- **Provider** — same `inference.ts` routing as generation. No model
  configured and offline → inline error pointing to Settings.

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
- `DocumentRepository.test.ts` — `updateSources` + `updateChat` + migration v2.
- `EditorWebView` bridge — `replaceCitationMarkers` serialization.
- `chatService.test.ts` — system prompt build + truncation cap, last-50
  context trimming, Apply-text extraction.
- `ChatPanel` — send/stream/apply flow with mocked `inference` (covered in
  component tests).