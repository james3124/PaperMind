export interface SaveStateTracker {
  isDirty(): boolean;
  edit(): void;
  markSaved(): void;
  beginExport(): void;
  endExportStaleEdits(): boolean;
}

export function createSaveStateTracker(): SaveStateTracker {
  let dirty = false;
  let exporting = false;
  let editedDuringExport = false;

  return {
    isDirty: () => dirty,
    edit() {
      if (exporting) {
        editedDuringExport = true;
      }
      dirty = true;
    },
    markSaved() {
      dirty = false;
    },
    beginExport() {
      exporting = true;
      editedDuringExport = false;
    },
    endExportStaleEdits() {
      exporting = false;
      const stale = editedDuringExport;
      editedDuringExport = false;
      return stale;
    },
  };
}
