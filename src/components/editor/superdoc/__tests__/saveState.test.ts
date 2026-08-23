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
});
