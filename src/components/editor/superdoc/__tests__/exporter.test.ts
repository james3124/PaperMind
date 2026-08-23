import {blobToBase64} from '@/components/editor/superdoc/bridge/exporter';

describe('blobToBase64', () => {
  it('encodes bytes as base64 without data-uri prefix', async () => {
    const blob = new Blob([Uint8Array.from([104, 105])]); // "hi"
    await expect(blobToBase64(blob)).resolves.toBe('aGk=');
  });
});
