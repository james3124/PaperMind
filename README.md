<div align="center">

# 📚 PaperMind

**Write, generate, and edit complete academic research papers — entirely on your phone.**

PaperMind is a fully self-contained **offline AI research-paper studio** for Android. No backend. No server. No API keys. The entire AI pipeline runs **on-device** using a local large language model, so your research stays private and works anywhere — even without an internet connection.

<img src="https://img.shields.io/badge/platform-Android-brightgreen" alt="Platform: Android">
<img src="https://img.shields.io/badge/framework-React%20Native%200.74-61dafb" alt="React Native 0.74">
<img src="https://img.shields.io/badge/language-TypeScript-3178c6" alt="TypeScript">
<img src="https://img.shields.io/badge/AI-On--Device%20(no%20cloud)-blueviolet" alt="On-device AI">
<a href="https://github.com/james3124/PaperMind/releases"><img src="https://img.shields.io/badge/download-APK-ff6b6b" alt="Download APK"></a>

</div>

---

## ✨ What it does

PaperMind turns a single research topic into a complete, citation-ready academic paper — and then gives you a full Word-style editor to refine it.

| Stage | What happens |
|---|---|
| **Generate** | Enter a topic + optional context, pick a research type, academic level, and paper length |
| **Plan** | The on-device AI formulates research questions, a thesis, and a full paper outline |
| **Cite real papers** | Queries **CrossRef, OpenAlex, Semantic Scholar, and arXiv** in parallel to fetch real, deduplicated sources |
| **Write** | Runs a **19-stage AI pipeline** to write every section: introduction, literature review, methodology, results, discussion, conclusion, abstract, and references |
| **Polish** | Applies an academic style + proofreading pass and formats a properly cited reference list (APA, MLA, IEEE, Chicago, Harvard, Vancouver) |
| **Edit** | Refine the paper in a rich text editor with a Word-style toolbar |
| **Export** | Save or share as **DOCX** — generated entirely on-device |

## 🎯 Benefits

- 🔒 **100% Private** — All AI inference runs on your device. Your papers never leave your phone.
- 🌍 **Works Offline** — No backend, no server, no API keys. Internet is only needed on first launch (to download the AI model) and optionally for literature search.
- 💸 **Free Forever** — No subscriptions, no per-token billing, no cloud costs. Bring your own phone.
- 📖 **Real citations** — References are generated from real academic sources, never invented.
- 📝 **Word-style editor** — Bold, headings, lists, alignment, colors, links, images, footnotes, find & replace, outline view, focus mode — a familiar editing experience.
- ✍️ **AI writing assistance** — Select any text and Rewrite, Fix Grammar, Explain, Summarize, Expand, Shorten, or switch to Academic Tone.
- 📂 **On-device library** — Search, star, sort, duplicate, and organize all your papers.
- 🔁 **DOCX in & out** — Import existing DOCX files and export finished papers, all locally.

## 📸 Screens

- **Library** — your papers, searchable, sortable, and filterable by star/status.
- **Generate** — guided two-step flow from topic to a 19-stage generation progress screen.
- **Editor** — a full rich-text editor with a Word-style toolbar and live word count.
- **Settings** — AI model status, theme (light / dark / system), and about.

## 🚀 Installation

> **Android only.** Download the latest APK from the [Releases page](https://github.com/james3124/PaperMind/releases).

1. Open the [latest release](https://github.com/james3124/PaperMind/releases/latest)
2. Download `app-debug.apk`
3. Open the file on your Android device and allow installation from unknown sources
4. Launch **PaperMind** — on first run it downloads the on-device AI model (~676 MB), then you're ready to generate

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.74 + TypeScript |
| Navigation | React Navigation v6 |
| State | Zustand |
| Database | WatermelonDB + SQLite (local) |
| On-device AI | llama.rn + Qwen2.5-0.5B-Instruct GGUF |
| Editor | Quill.js via WebView |
| Literature search | CrossRef, OpenAlex, Semantic Scholar, arXiv (free, no key) |
| DOCX in/out | jszip + react-native-fs (fully on-device) |
| CI / APK build | GitHub Actions + Gradle |

## 🏗️ Development

### Prerequisites

- Node 18+, Java 17, Android SDK 35
- Complete the [React Native environment setup](https://reactnative.dev/docs/environment-setup)

### Run it

```bash
npm install

# Start Metro
npm start

# Run on Android
npm run android
```

### Test & lint

```bash
npm test
npm run lint
```

### Build the APK locally

```bash
cd android && ./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

> Pushing a `v*` tag triggers [GitHub Actions](.github/workflows/build_apk.yml), which builds the APK and attaches it to a new [Release](https://github.com/james3124/PaperMind/releases).

## 📁 Project Structure

```
src/
├── db/          # WatermelonDB setup, models, migrations
├── stores/      # Zustand stores (settings)
├── services/    # llamaService, pipelineService, literatureSearch, docxImport/Export
├── screens/     # Library, Generate, Progress, Editor, Model Download, Settings
├── components/  # editor/, library/, generate/ subcomponents
├── navigation/  # AppNavigator
└── utils/       # model paths, provider config
```

## 📄 License

Private project — all rights reserved.
