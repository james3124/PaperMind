# Design: 3-Minute AI Model Idle Auto-Release

**Date:** 2026-08-14

## Problem

`llamaService` holds a singleton `LlamaContext` in memory from `initModel()` until the app is closed. The model occupies ~500MB+ RAM while loaded, even when the user is not using the AI. This wastes memory on devices where RAM is constrained.

## Goal

Automatically release the model from memory after **3 minutes** of AI inactivity:

- Any AI **inference** (`complete()` or `stream()`) resets the timer back to 3 minutes.
- When the timer expires, the context is fully released (`releaseModel()`).
- The next AI use **auto-reloads** the model and then runs, with no manual step.

## Non-Goals

- No new UI (no countdown display, no idle indicator).
- No background/app-state handling (timer runs as long as the JS runtime is alive; RN does not guarantee timers in the background).
- No settings toggle for the idle duration.
- No change to `ModelDownloadScreen`. `GenerateScreen`/`ProgressScreen`/`EditorScreen` get minimal guard changes (see "Callers — guard updates").

## Architecture

All idle logic lives inside `src/services/llamaService.ts` (Approach A, approved). The only caller changes are pre-inference guards that currently block on `isModelLoaded()`/`modelLoaded`, described below.

### Current code

```ts
let _context: LlamaContext | null = null;

export async function initModel(modelPath: string): Promise<void> {
  if (_context) return;
  _context = await initLlama({ model: modelPath, n_ctx: 2048, n_threads: 4, n_gpu_layers: 0 });
}

export async function releaseModel(): Promise<void> {
  if (_context) { await _context.release(); _context = null; }
}

export async function complete(messages, temperature = 0.7, maxTokens = 1024): Promise<string> {
  if (!_context) throw new Error('Model not loaded...');
  ...
}

export async function stream(messages, onToken, temperature = 0.7, maxTokens = 1024): Promise<void> {
  if (!_context) throw new Error('Model not loaded...');
  ...
}
```

### Proposed code

```ts
import { initLlama, LlamaContext } from 'llama.rn';
import { useSettingsStore } from '@/stores/settingsStore';
import { MODEL_PATH } from '@/utils/modelPaths';

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

let _context: LlamaContext | null = null;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleTimer(): void {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
}

function resetIdleTimer(): void {
  clearIdleTimer();
  _idleTimer = setTimeout(() => { void releaseModel(); }, IDLE_TIMEOUT_MS);
}

async function ensureModelLoaded(): Promise<void> {
  if (!_context) {
    await initModel(MODEL_PATH);
    useSettingsStore.getState().setModelLoaded(true);
  }
}

export function isModelLoaded(): boolean {
  return _context !== null;
}

export async function initModel(modelPath: string): Promise<void> {
  if (_context) return;
  _context = await initLlama({ model: modelPath, n_ctx: 2048, n_threads: 4, n_gpu_layers: 0 });
  resetIdleTimer();
}

export async function releaseModel(): Promise<void> {
  clearIdleTimer();
  if (_context) {
    await _context.release();
    _context = null;
  }
  useSettingsStore.getState().setModelLoaded(false);
}

export async function complete(...): Promise<string> {
  await ensureModelLoaded();
  resetIdleTimer();
  ...run inference...
}

export async function stream(...): Promise<void> {
  await ensureModelLoaded();
  resetIdleTimer();
  ...run inference...
}
```

### Notes

- **`ensureModelLoaded()`** makes auto-reload transparent: if the model was idle-released, `complete()`/`stream()` reload it before running. The first call after idle pays a reload delay.
- **Settings store sync:** idle expiry sets `modelLoaded=false`; successful reload sets `modelLoaded=true`. This keeps every UI that reads `settings.modelLoaded` (Settings badge, GenerateScreen, ProgressScreen) accurate.
- **`MODEL_PATH`** is imported directly so reload doesn't require the caller to pass the path again.
- `initModel` no longer needs the caller's `modelPath` for reload, but keeps its signature for App.tsx/ModelDownloadScreen compatibility. (App.tsx and ModelDownloadScreen still call `setModelLoaded(true)` after `initModel` — that remains correct.)

### 3. Callers — guard updates for auto-reload

`modelLoaded` no longer means "model available" — only "currently in memory". Screens gate on **file existence** (`modelExists()`) so an idle-released model auto-reloads instead of being mistaken for a missing download:

- **`EditorScreen.handleAiAction`** — remove the `if (!isModelLoaded()) { Alert('Model Not Ready') }` guard. `complete()` auto-reloads; inference errors still surface via the existing `catch`.
- **`GenerateScreen.handleGenerate`** — change `if (!settings.modelLoaded) { navigation.navigate('ModelDownload'); }` to `if (!(await modelExists())) { navigation.navigate('ModelDownload'); }`.
- **`GenerateScreen` warning text** — change the `!settings.modelLoaded` condition to `!(await modelExists())` so the warning only appears when no model file exists.
- **`ProgressScreen.run`** — change `if (!isModelLoaded()) { setFatalError(...) }` to `if (!(await modelExists())) { setFatalError(...) }`.

These keep the "download first" UX for users with no model file while letting idle-released models reload transparently.

## Components / Data Flow

| Unit | Responsibility |
|---|---|
| `llamaService.initModel()` | Create context, arm 3-min idle timer |
| `llamaService.resetIdleTimer()` (internal) | Clear + re-arm timer on any inference |
| `llamaService.ensureModelLoaded()` (internal) | Reload context if idle-released, before inference |
| `llamaService.releaseModel()` | Clear timer, release context, set `modelLoaded=false` |
| `llamaService.complete()` / `stream()` | Ensure loaded, reset timer, run inference |
| `settingsStore.modelLoaded` | UI state reflecting loaded/unloaded |

## Error Handling

- If auto-reload fails during `ensureModelLoaded()` (e.g. file missing), the original error propagates to the caller; existing `catch` blocks in `EditorScreen`/`GenerateScreen` still surface an alert. No new error handling needed.
- `releaseModel()` already tolerates a null context.

## Testing

`src/services/__tests__/llamaService.test.ts` (extend with `jest.useFakeTimers()`):

1. `initModel` arms a 3-minute idle timer (advance timers → context released, `modelLoaded=false`).
2. `complete()` resets the timer (advance < 3 min, no release; call `complete()`, then advance 3 min from the reset → releases).
3. After idle release, `complete()` auto-reloads via `MODEL_PATH` and succeeds.
4. `releaseModel()` clears the timer.
5. Existing tests (formatChatML, exports, isModelLoaded) keep passing.

## Verification

- `npx tsc --noEmit`
- `npx eslint` on changed files
- `npx jest --forceExit` (all suites)
