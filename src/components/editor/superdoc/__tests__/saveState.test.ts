import {createSaveStateTracker} from '@/components/editor/superdoc/bridge/saveState';

describe('createSaveStateTracker', () => {
  it('starts clean', () => {
    const t = createSaveStateTracker();
    expect(t.isDirty()).toBe(false);
  });

  it('marks dirty on edit and clean on markSaved', () => {
    const t = createSaveStateTracker();
    t.edit();
    expect(t.isDirty()).toBe(true);
    t.markSaved();
    expect(t.isDirty()).toBe(false);
  });

  it('reports no stale edits when export completes without concurrent edits', () => {
    const t = createSaveStateTracker();
    t.beginExport();
    expect(t.endExportStaleEdits()).toBe(false);
  });

  it('flags edits made while an export is in flight so they are not lost as saved', () => {
    const t = createSaveStateTracker();
    t.edit();
    t.beginExport();
    t.edit();
    t.markSaved();
    expect(t.endExportStaleEdits()).toBe(true);
  });

  it('keeps edits outside the export window out of the stale check', () => {
    const t = createSaveStateTracker();
    t.edit();
    t.beginExport();
    expect(t.endExportStaleEdits()).toBe(false);
  });

  it('resets the stale flag between exports', () => {
    const t = createSaveStateTracker();
    t.beginExport();
    t.edit();
    expect(t.endExportStaleEdits()).toBe(true);
    t.beginExport();
    expect(t.endExportStaleEdits()).toBe(false);
  });

  it('flags both overlapping exporters when edits occur mid-first and mid-second', () => {
    const t = createSaveStateTracker();
    t.edit();
    t.beginExport(); // E1
    t.edit(); // mid-first
    t.markSaved();
    t.beginExport(); // E2 overlaps E1
    t.edit(); // mid-second
    t.markSaved();
    expect(t.endExportStaleEdits()).toBe(true); // E1 finishes late
    expect(t.endExportStaleEdits()).toBe(true); // E2 finishes last
  });

  it('does not let the first exporter consume the stale flag the second still needs', () => {
    const t = createSaveStateTracker();
    t.beginExport(); // E1
    t.beginExport(); // E2
    t.edit();
    t.markSaved();
    expect(t.endExportStaleEdits()).toBe(true); // E1
    expect(t.endExportStaleEdits()).toBe(true); // E2 must still see the edit
  });

  it('clears the stale flag only after the last overlapping export finishes', () => {
    const t = createSaveStateTracker();
    t.beginExport();
    t.beginExport();
    t.edit();
    expect(t.endExportStaleEdits()).toBe(true);
    expect(t.endExportStaleEdits()).toBe(true);
    t.beginExport();
    expect(t.endExportStaleEdits()).toBe(false);
  });

  it('keeps sequential (non-overlapping) exports independent', () => {
    const t = createSaveStateTracker();
    t.beginExport();
    t.edit();
    expect(t.endExportStaleEdits()).toBe(true);
    t.beginExport();
    expect(t.endExportStaleEdits()).toBe(false);
  });
});
