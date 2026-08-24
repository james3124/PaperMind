# PaperMind v1.1.0 — Cloud AI, Citation Manager, Paper Chat

## ✨ New

### Optional Cloud AI
- Bring your own **OpenAI-compatible endpoint**: any provider, custom base URL + API key, model name — all configured in Settings.
- **Test connection** button with latency check in Settings.
- **Automatic on-device fallback**: if the cloud fails mid-generation, PaperMind switches to the local Qwen model and tells you — plus Retry and "Use on-device model instead" actions.
- On-device generation stays the default and works exactly as before — cloud is purely opt-in.

### Citation Manager
- **Review sources before generation**: pick exactly which of the searched papers go into your paper.
- **Swap citations in the editor**: replace any citation with another source (from the paper's sources or a fresh search) — markers and the reference list update automatically.
- **Deterministic references**: the reference section (APA, MLA, IEEE, Chicago, Harvard, Vancouver) is rebuilt by code from your chosen sources, never invented or re-written by the AI.

### Paper-Aware Editor Chat
- Ask questions about your paper in the editor; the AI answers with your paper and sources in context (6 styles supported).
- **Insert at cursor**: apply any answer directly into the document.
- Chat history is saved per paper.

## 🛠 Improvements
- Source toggles for literature search (CrossRef, OpenAlex, Semantic Scholar, arXiv) now used consistently across search, generation, and citation picker.
- 30s timeout on all cloud requests (no more stuck "Testing…").
- Database schema migrated to v2 (existing documents preserved).

## 📦 Notes
- APK: app-debug.apk (Android)
- Full change list: see git history between `v1.0.5` and `v1.1.0`