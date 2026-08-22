<h1 align="center">
  <a href="https://github.com/james3124/PaperMind">
    <img src="https://github.com/james3124/PaperMind/android/app/src/main/res/mipmap-hdpi/ic_launcher.png" alt="PaperMind" width="256" height="256" />
  </a>
  <br/>
  PaperMind
</h1>
<div align="center">


**Write, generate, and edit complete academic research papers — entirely on your phone.**

PaperMind is an AI research-paper studio for Android. The entire AI pipeline runs **on-device** by default using a local large language model — so your research stays private and works anywhere, even without an internet connection. Optionally connect **any OpenAI-compatible API** (your own key, your own provider) for faster, higher-quality generation with automatic on-device fallback.

<img src="https://img.shields.io/badge/platform-Android-brightgreen" alt="Platform: Android">
<img src="https://img.shields.io/badge/framework-React%20Native%200.74-61dafb" alt="React Native 0.74">
<img src="https://img.shields.io/badge/language-TypeScript-3178c6" alt="TypeScript">
<img src="https://img.shields.io/badge/AI-On--Device%20%2B%20optional%20cloud-blueviolet" alt="On-device AI + optional cloud">
<a href="https://github.com/james3124/PaperMind/releases"><img src="https://img.shields.io/badge/download-APK-ff6b6b" alt="Download APK"></a>

</div>

---

## ✨ What it does

PaperMind turns a single research topic into a complete, citation-ready academic paper — and then gives you a full Word-style editor to refine it.

| Stage | What happens |
|---|---|
| **Generate** | Enter a topic + optional context, pick a research type, academic level, and paper length |
| **Plan** | The AI formulates research questions, a thesis, and a full paper outline |
| **Cite real papers** | Queries **CrossRef, OpenAlex, Semantic Scholar, and arXiv** in parallel to fetch real, deduplicated sources — toggle which sources to search |
| **Review sources** | Pick and choose exactly which sources go into your paper before generation |
| **Write** | Runs a **19-stage AI pipeline** to write every section: introduction, literature review, methodology, results, discussion, conclusion, abstract, and references |
| **Polish** | Applies an academic style + proofreading pass and formats a properly cited reference list (APA, MLA, IEEE, Chicago, Harvard, Vancouver) |
| **Edit** | Refine the paper in a rich text editor with a Word-style toolbar; swap any citation in-place and rebuild the reference list automatically |
| **Chat** | Ask questions about your paper and insert the AI's answer directly at the cursor |
| **Export** | Save or share as **DOCX** — generated on-device |

## 🎯 Benefits

- 🔒 **100% Private by Default** — All AI inference runs on your device unless you opt into cloud AI. Your papers never leave your phone.
- 🌍 **Works Offline** — No backend, no server. Internet is only needed on first launch (to download the AI model) and optionally for literature search.
- ☁️ **Optional Cloud AI** — Bring your own OpenAI-compatible API key for faster, stronger generation; falls back to on-device automatically if the cloud fails.
- 💸 **Free Forever** — No subscriptions, no cloud costs. Bring your own phone.
- 📖 **Real citations** — References are generated from real academic sources, never invented.
- 🎯 **Citation control** — Choose your sources before generation and swap any citation in the editor; the reference list updates automatically.
- 💬 **Paper-aware chat** — Ask the AI anything about your paper and insert the answer at the cursor.
- 📝 **Word-style editor** — Bold, headings, lists, alignment, colors, links, images, footnotes, find & replace, outline view, focus mode — a familiar editing experience.
- ✍️ **AI writing assistance** — Select any text and Rewrite, Fix Grammar, Explain, Summarize, Expand, Shorten, or switch to Academic Tone.
- 📂 **On-device library** — Search, star, sort, duplicate, and organize all your papers.
- 🔁 **DOCX in & out** — Import existing DOCX files and export finished papers, all locally.

## 📸 Screens

- **Library** — your papers, searchable, sortable, and filterable by star/status.
- **Generate** — guided two-step flow from topic to a 19-stage generation progress screen.
- **Editor** — a full rich-text editor with a Word-style toolbar and live word count.
- **Settings** — AI provider (on-device or cloud with connection test), AI model status, theme (light / dark / system), and about.

## 🚀 Installation

> **Android only.** Download the latest APK from the [Releases page](https://github.com/james3124/PaperMind/releases).

1. Open the [latest release](https://github.com/james3124/PaperMind/releases/latest)
2. Download `app-debug.apk`
3. Open the file on your Android device and allow installation from unknown sources

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.74 + TypeScript |
| Navigation | React Navigation v6 |
| State | Zustand |
| Database | WatermelonDB + SQLite (local) |
| On-device AI | llama.rn + Qwen2.5-0.5B-Instruct GGUF |
| Optional cloud AI | Any OpenAI-compatible endpoint (custom base URL + key) |
| Editor | Quill.js via WebView |
| Literature search | CrossRef, OpenAlex, Semantic Scholar, arXiv (free, no key) |
| DOCX in/out | jszip + react-native-fs (fully on-device) |
| CI / APK build | GitHub Actions + Gradle |

