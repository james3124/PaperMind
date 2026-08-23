export interface SaveStateTracker {
  isDirty(): boolean;
  edit(): void;
  markSaved(): void;
  beginExport(): void;
  endExportStaleEdits(): boolean;
}

export function createSaveStateTracker(): SaveStateTracker {
  let dirty = false;
  let inflightExports = 0;
  let editedDuringExport = false;

  return {
    isDirty: () => dirty,
    edit() {
      if (inflightExports > 0) {
        editedDuringExport = true;
      }
      dirty = true;
    },
    markSaved() {
      dirty = false;
    },
    beginExport() {
      inflightExports += 1;
    },
    endExportStaleEdits() {
      const stale = editedDuringExport;
      inflightExports = Math.max(0, inflightExports - 1);
      if (inflightExports === 0) {
        editedDuringExport = false;
      }
      return stale;
    },
  };
}
