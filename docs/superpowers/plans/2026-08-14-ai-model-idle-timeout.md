# 3-Minute AI Model Idle Auto-Release — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release the loaded AI model from memory after 3 minutes of AI inactivity, reset the timer on any inference, and auto-reload on the next use.

**Architecture:** Idle logic lives entirely inside `src/services/llamaService.ts` (Approach A). A module-level `setTimeout` is armed on `initModel()`, reset on `complete()`/`stream()`, and fires `releaseModel()` on expiry. `complete()`/`stream()` call an internal `ensureModelLoaded()` that reloads via `MODEL_PATH` if the context was idle-released. Three screens change a pre-inference guard from "model is in memory" (`modelLoaded`/`isModelLoaded()`) to "model file exists" (`modelExists()`).

**Tech Stack:** React Native 0.74.5, llama.rn 0.12.9, zustand (`useSettingsStore`), Jest + `jest.useFakeTimers()`.

## Global Constraints

- Idle timeout is exactly `3 * 60 * 1000` ms (3 minutes).
- No new UI, no settings toggle, no countdown display.
- `modelLoaded` in the settings store means "context is in memory", not "model file exists".
- Inference = a call to `complete()` or `stream()`. Opening the AI panel does NOT reset the timer.
- App-level behavior is unchanged: `App.tsx` and `ModelDownloadScreen` still call `initModel(modelPath)` then `setModelLoaded(true)`.
- `initModel(modelPath)` keeps its existing signature (caller compatibility).
- `llamaService.ts` imports must remain jest-safe: `react-native-fs` must be mocked in tests because `modelPaths.ts` imports it.

---

### Task 1: Add idle timer + auto-reload to `llamaService.ts`

**Files:**
- Modify: `src/services/llamaService.ts`
- Test: `src/services/__tests__/llamaService.test.ts`

**Interfaces:**
- Consumes: `MODEL_PATH` from `@/utils/modelPaths`, `useSettingsStore` from `@/stores/settingsStore`, `initLlama`/`LlamaContext` from `llama.rn`.
- Produces: unchanged public API — `initModel(modelPath)`, `releaseModel()`, `isModelLoaded()`, `complete(...)`, `stream(...)`. Internal helpers `resetIdleTimer()` and `ensureModelLoaded()` (not exported).

- [ ] **Step 1: Update the test file's mocks**

Add `react-native-fs` mock to the top of `src/services/__tests__/llamaService.test.ts` (before imports), so the new `modelPaths` import works:

```ts
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/data/user/0/com.papermind/files',
  exists: jest.fn().mockResolvedValue(false),
  mkdir:  jest.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 2: Write the failing idle-timer tests**

Add to `src/services/__tests__/llamaService.test.ts`:

```ts
describe('idle timer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('initModel arms a 3-minute timer that releases the context', async () => {
    const { initModel, releaseModel, isModelLoaded } = require('../llamaService');
    await initModel('/mock/model.gguf');
    expect(isModelLoaded()).toBe(true);
    jest.advanceTimersByTime(3 * 60 * 1000);
    await Promise.resolve();
    expect(isModelLoaded()).toBe(false);
  });

  it('complete() resets the idle timer', async () => {
    const { initModel, isModelLoaded, complete } = require('../llamaService');
    await initModel('/mock/model.gguf');
    jest.advanceTimersByTime(2 * 60 * 1000);
    await complete([{ role: 'user', content: 'hi' }]);
    // 2 min elapsed + a fresh inference — still loaded after another 2 min
    jest.advanceTimersByTime(2 * 60 * 1000);
    await Promise.resolve();
    expect(isModelLoaded()).toBe(true);
    // crossing 3 min from the reset releases
    jest.advanceTimersByTime(60 * 1000);
    await Promise.resolve();
    expect(isModelLoaded()).toBe(false);
  });

  it('releases the model when idle expires and modelLoaded is set false', async () => {
    const { initModel } = require('../llamaService');
    const { useSettingsStore } = require('@/stores/settingsStore');
    useSettingsStore.setState({ modelLoaded: true });
    await initModel('/mock/model.gguf');
    jest.advanceTimersByTime(3 * 60 * 1000);
    await Promise.resolve();
    expect(useSettingsStore.getState().modelLoaded).toBe(false);
  });

  it('complete() auto-reloads the model after idle release', async () => {
    const { initModel, complete, isModelLoaded } = require('../llamaService');
    const { initLlama } = require('llama.rn');
    (initLlama as jest.Mock).mockClear();
    await initModel('/mock/model.gguf');
    jest.advanceTimersByTime(3 * 60 * 1000);
    await Promise.resolve();
    expect(isModelLoaded()).toBe(false);
    const result = await complete([{ role: 'user', content: 'hi' }]);
    expect(result).toBe('Mock response');
    expect(isModelLoaded()).toBe(true);
    expect(initLlama).toHaveBeenCalled();
  });

  it('releaseModel() clears the pending idle timer', async () => {
    const { initModel, releaseModel, isModelLoaded } = require('../llamaService');
    await initModel('/mock/model.gguf');
    await releaseModel();
    jest.advanceTimersByTime(3 * 60 * 1000);
    await Promise.resolve();
    expect(isModelLoaded()).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `npx jest src/services/__tests__/llamaService.test.ts --forceExit -t "idle timer"`
Expected: FAIL — `complete()`/`initModel` don't yet arm/reset a timer, so the idle-release assertions fail.

- [ ] **Step 4: Implement the idle logic in `llamaService.ts`**

Replace the top of `src/services/llamaService.ts`:

```ts
import { initLlama, LlamaContext } from 'llama.rn';
import { MODEL_PATH } from '@/utils/modelPaths';
import { useSettingsStore } from '@/stores/settingsStore';

export interface CompletionMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

// ── Singleton context ─────────────────────────────────────────────────────────

let _context: LlamaContext | null = null;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleTimer(): void {
  if (_idleTimer) {
    clearTimeout(_idleTimer);
    _idleTimer = null;
  }
}

function resetIdleTimer(): void {
  clearIdleTimer();
  _idleTimer = setTimeout(() => {
    void releaseModel();
  }, IDLE_TIMEOUT_MS);
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
  if (_context) return; // Already loaded
  _context = await initLlama({
    model:        modelPath,
    n_ctx:        2048,
    n_threads:    4,
    n_gpu_layers: 0,   // CPU only — Android GPU support is unstable
  });
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
```

Then update `complete()` and `stream()` to `await ensureModelLoaded()` and `resetIdleTimer()` at the top (replacing the `if (!_context) throw` guards):

```ts
export async function complete(
  messages:     CompletionMessage[],
  temperature:  number = 0.7,
  maxTokens:    number = 1024,
): Promise<string> {
  await ensureModelLoaded();
  resetIdleTimer();

  const prompt = formatChatML(messages);
  const result = await _context!.completion({
    prompt,
    n_predict:   maxTokens,
    temperature,
    stop:        ['<|im_end|>', '<|im_start|>'],
  });

  return result.text.trim();
}

export async function stream(
  messages:    CompletionMessage[],
  onToken:     (token: string) => void,
  temperature: number = 0.7,
  maxTokens:   number = 1024,
): Promise<void> {
  await ensureModelLoaded();
  resetIdleTimer();

  const prompt = formatChatML(messages);
  await _context!.completion(
    {
      prompt,
      n_predict:   maxTokens,
      temperature,
      stop:        ['<|im_end|>', '<|im_start|>'],
    },
    (data) => {
      if (data.token) onToken(data.token);
    }
  );
}
```

- [ ] **Step 5: Run the test file to verify it passes**

Run: `npx jest src/services/__tests__/llamaService.test.ts --forceExit`
Expected: PASS — all existing + new tests green.

- [ ] **Step 6: Commit**

```bash
git add src/services/llamaService.ts src/services/__tests__/llamaService.test.ts
git commit -m "feat(ai): idle-release model after 3 minutes and auto-reload on next use"
```

---

### Task 2: Switch EditorScreen AI guard from in-memory to file-exists

**Files:**
- Modify: `src/screens/EditorScreen.tsx` (`handleAiAction`, lines ~117-124)

**Interfaces:**
- Consumes: `modelExists` from `@/utils/modelPaths`.
- Produces: `handleAiAction` no longer shows the "Model Not Ready" alert; `complete()` handles reload.

- [ ] **Step 1: Add the import**

In `src/screens/EditorScreen.tsx`, add to the imports:

```ts
import {modelExists} from '@/utils/modelPaths';
```

- [ ] **Step 2: Remove the in-memory guard in `handleAiAction`**

Replace:

```ts
const handleAiAction = useCallback(async (prompt: string, text: string) => {
  if (!isModelLoaded()) {
    Alert.alert(
      'Model Not Ready',
      'The AI model is still loading. Please wait.',
    );
    return;
  }
  try {
```

with:

```ts
const handleAiAction = useCallback(async (prompt: string, text: string) => {
  try {
```

- [ ] **Step 3: Remove the now-unused `isModelLoaded` import**

In `src/screens/EditorScreen.tsx`, change the llamaService import from:

```ts
import {complete, isModelLoaded} from '@/services/llamaService';
```

to:

```ts
import {complete} from '@/services/llamaService';
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/screens/EditorScreen.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/EditorScreen.tsx
git commit -m "refactor(editor): remove stale model-in-memory guard from AI action"
```

---

### Task 3: Switch GenerateScreen guards from in-memory to file-exists

**Files:**
- Modify: `src/screens/GenerateScreen.tsx` (`handleGenerate` ~line 50, warning text ~line 171)

**Interfaces:**
- Consumes: `modelExists` from `@/utils/modelPaths`.
- Produces: `handleGenerate` navigates to `ModelDownload` only when the model file is absent.

- [ ] **Step 1: Add the import**

In `src/screens/GenerateScreen.tsx`, add:

```ts
import {modelExists} from '@/utils/modelPaths';
```

- [ ] **Step 2: Change `handleGenerate` to an async file check**

Replace:

```ts
function handleGenerate() {
  if (!topic.trim()) return;
  if (!settings.modelLoaded) {
    navigation.navigate('ModelDownload');
    return;
  }
  setShowCitation(true);
}
```

with:

```ts
async function handleGenerate() {
  if (!topic.trim()) return;
  if (!(await modelExists())) {
    navigation.navigate('ModelDownload');
    return;
  }
  setShowCitation(true);
}
```

- [ ] **Step 3: Change the warning text to use a `modelMissing` state**

JSX cannot `await`, so check `modelExists()` in a `useEffect` and store the result in state. Add near the other `useState` hooks:

```ts
const [modelMissing, setModelMissing] = useState(false);

useEffect(() => {
  let cancelled = false;
  (async () => {
    const exists = await modelExists();
    if (!cancelled) setModelMissing(!exists);
  })();
  return () => {
    cancelled = true;
  };
}, []);
```

Then replace the warning render:

```tsx
{!settings.modelLoaded && (
  <Text style={styles.noKeyWarning}>
    ⚠️ AI model not loaded — tap "Generate Paper" to download it first.
  </Text>
)}
```

with:

```tsx
{modelMissing && (
  <Text style={styles.noKeyWarning}>
    ⚠️ AI model not loaded — tap "Generate Paper" to download it first.
  </Text>
)}
```

Ensure `useEffect` and `useState` are imported from `react` in `GenerateScreen.tsx` (add to the existing React import if missing).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/screens/GenerateScreen.tsx`
Expected: no errors. Fix the `noKeyWarning` condition per the note if `await` in JSX fails to typecheck (use a `useEffect` + state instead).

- [ ] **Step 5: Commit**

```bash
git add src/screens/GenerateScreen.tsx
git commit -m "refactor(generate): gate download redirect on model file existence"
```

---

### Task 4: Switch ProgressScreen fatal guard from in-memory to file-exists

**Files:**
- Modify: `src/screens/ProgressScreen.tsx` (`run()` ~lines 41-45)

**Interfaces:**
- Consumes: `modelExists` from `@/utils/modelPaths`.
- Produces: `run()` only reports a fatal error when the model file is missing.

- [ ] **Step 1: Add the import**

In `src/screens/ProgressScreen.tsx`, add:

```ts
import {modelExists} from '@/utils/modelPaths';
```

- [ ] **Step 2: Change the guard**

Replace:

```ts
async function run() {
  if (!isModelLoaded()) {
    setFatalError('AI model is not loaded. Please restart the app.');
    return;
  }
```

with:

```ts
async function run() {
  if (!(await modelExists())) {
    setFatalError('AI model is not loaded. Please restart the app.');
    return;
  }
```

- [ ] **Step 3: Remove the now-unused `isModelLoaded` import**

In `src/screens/ProgressScreen.tsx`, change:

```ts
import { isModelLoaded } from '@/services/llamaService';
```

to remove that import line entirely.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/screens/ProgressScreen.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ProgressScreen.tsx
git commit -m "refactor(progress): gate fatal error on model file existence"
```

---

### Task 5: Full verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx jest --forceExit`
Expected: all suites pass (existing 63 + new llamaService idle tests).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint src/services/llamaService.ts src/screens/EditorScreen.tsx src/screens/GenerateScreen.tsx src/screens/ProgressScreen.tsx`
Expected: 0 errors (pre-existing warnings like nested components are acceptable).

- [ ] **Step 4: Final commit (if any uncommitted changes remain)**

```bash
git status
git add -A
git commit -m "chore: verify idle timeout feature"
```

---