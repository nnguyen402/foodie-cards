import { describe, expect, it } from 'vitest';
import { nativeReceiptPart } from '../src/features/receipts/receipt-image';

describe('nativeReceiptPart', () => {
  it('is a file-like part with a name, a jpeg type and the file bytes, which Expo fetch can upload', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const part = nativeReceiptPart({ bytes: async () => bytes }, 'receipt-1.jpg', 'image/jpeg') as unknown as { name: string; type: string; bytes(): Promise<Uint8Array> };
    expect(part.name).toBe('receipt-1.jpg');
    expect(part.type).toBe('image/jpeg');
    expect(await part.bytes()).toBe(bytes);
  });
});
