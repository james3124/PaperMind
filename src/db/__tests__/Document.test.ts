import {DocumentStatus} from '../models/Document';
import {STATUS_LABELS, STATUS_COLORS} from '../models/Document';

describe('DocumentStatus', () => {
  it('has label for every status', () => {
    const statuses: DocumentStatus[] = [
      'draft',
      'aiReady',
      'analyzing',
      'finalDraft',
    ];
    statuses.forEach(s => {
      expect(STATUS_LABELS[s]).toBeTruthy();
      expect(STATUS_COLORS[s]).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  it('draft is the default status label', () => {
    expect(STATUS_LABELS.draft).toBe('Draft');
  });

  it('finalDraft label is Final', () => {
    expect(STATUS_LABELS.finalDraft).toBe('Final');
  });
});
