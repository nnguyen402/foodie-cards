import { describe, expect, it, vi } from 'vitest';
import { prepareWebReceiptBlob } from '../src/features/receipts/receipt-image';

describe('web receipt image preparation', () => {
  it('returns the prepared image bytes as a supported JPEG Blob', async () => {
    const bytes = new Blob(['compressed jpeg bytes'], { type: 'image/jpeg' });
    const fetcher = vi.fn().mockResolvedValue(new Response(bytes));

    const prepared = await prepareWebReceiptBlob('blob:https://app.example.test/prepared', fetcher);

    expect(prepared).toBeInstanceOf(Blob);
    expect(prepared.type).toBe('image/jpeg');
    expect(prepared.size).toBe(21);
    expect(fetcher).toHaveBeenCalledWith('blob:https://app.example.test/prepared');
  });

  it('rejects an empty prepared image', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Blob([], { type: 'image/jpeg' })));

    await expect(prepareWebReceiptBlob('blob:empty', fetcher))
      .rejects.toThrow('The edited image is empty. Choose the receipt again.');
  });

  it('rejects a prepared image over the upload limit using its actual Blob size', async () => {
    const bytes = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/jpeg' });
    const fetcher = vi.fn().mockResolvedValue(new Response(bytes));

    await expect(prepareWebReceiptBlob('blob:large', fetcher))
      .rejects.toThrow('This receipt image is still over 10 MB after compression. Choose another photo.');
  });

  it('rejects a prepared Blob with an unsupported MIME type', async () => {
    const bytes = new Blob(['not an image'], { type: 'application/octet-stream' });
    const fetcher = vi.fn().mockResolvedValue(new Response(bytes));

    await expect(prepareWebReceiptBlob('blob:unsupported', fetcher))
      .rejects.toThrow('The edited image format is not supported. Choose a JPEG, PNG, or WebP photo.');
  });

  it('rejects failed reads of the prepared image URI', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));

    await expect(prepareWebReceiptBlob('blob:missing', fetcher))
      .rejects.toThrow('The edited image could not be opened. Choose the receipt again.');
  });

  it('uses JPEG for a prepared blob with no browser-reported MIME type', async () => {
    const bytes = new Blob(['prepared image']);
    const fetcher = vi.fn().mockResolvedValue(new Response(bytes));

    const prepared = await prepareWebReceiptBlob('blob:no-type', fetcher);

    expect(prepared.type).toBe('image/jpeg');
    expect(prepared.size).toBe(14);
  });
});
