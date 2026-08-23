import {create} from 'zustand';
import RNFS from 'react-native-fs';
import {
  MODEL_URL,
  getModelPath,
  ensureModelDir,
  modelExists,
} from '@/utils/modelPaths';

interface ModelDownloadState {
  // ── State ──────────────────────────────────────────────────────────────────
  modelReady: boolean;
  downloading: boolean;
  downloadProgress: number; // 0–1
  downloadedBytes: number;
  totalBytes: number;
  downloadError: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  bootstrap: () => Promise<void>;
  startDownload: () => void;
  cancelDownload: () => void;
  setModelReady: (v: boolean) => void;
}

let _jobId: number | null = null;

export const useModelDownloadStore = create<ModelDownloadState>((set, get) => ({
  modelReady: false,
  downloading: false,
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  downloadError: null,

  setModelReady: v => set({modelReady: v}),

  /** Call once on app start. If model exists → ready. Otherwise start download. */
  bootstrap: async () => {
    const exists = await modelExists();
    if (exists) {
      set({modelReady: true});
    } else {
      get().startDownload();
    }
  },

  startDownload: () => {
    if (get().downloading) {
      return;
    }

    set({downloading: true, downloadError: null});

    void (async () => {
      try {
        await ensureModelDir();

        const dest = getModelPath();
        // Resume support: check existing partial file size
        const partialExists = await RNFS.exists(dest);
        const existingSize = partialExists ? (await RNFS.stat(dest)).size : 0;

        const headers: Record<string, string> =
          existingSize > 0 ? {Range: `bytes=${existingSize}-`} : {};

        const {jobId, promise} = RNFS.downloadFile({
          fromUrl: MODEL_URL,
          toFile: dest,
          headers,
          progressInterval: 500,
          progress: res => {
            const total = res.contentLength + existingSize;
            const written = res.bytesWritten + existingSize;
            set({
              downloadProgress: total > 0 ? written / total : 0,
              downloadedBytes: written,
              totalBytes: total,
            });
          },
        });

        _jobId = jobId;
        const result = await promise;
        _jobId = null;

        if (result.statusCode === 200 || result.statusCode === 206) {
          set({
            downloading: false,
            modelReady: true,
            downloadProgress: 1,
          });
        } else {
          throw new Error(`HTTP ${result.statusCode}`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        set({downloading: false, downloadError: msg});
      }
    })();
  },

  cancelDownload: () => {
    if (_jobId !== null) {
      RNFS.stopDownload(_jobId);
      _jobId = null;
    }
    set({downloading: false});
  },
}));
