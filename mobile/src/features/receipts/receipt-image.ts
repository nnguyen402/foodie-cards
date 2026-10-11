const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function prepareWebReceiptBlob(uri: string, fetcher: typeof fetch = fetch): Promise<Blob> {
  let response: Response;
  try {
    response = await fetcher(uri);
  } catch {
    throw new Error('The edited image could not be opened. Choose the receipt again.');
  }
  if (!response.ok) throw new Error('The edited image could not be opened. Choose the receipt again.');

  let image: Blob;
  try {
    image = await response.blob();
  } catch {
    throw new Error('The edited image could not be opened. Choose the receipt again.');
  }
  if (image.size <= 0) throw new Error('The edited image is empty. Choose the receipt again.');
  if (image.size > MAX_IMAGE_BYTES) {
    throw new Error('This receipt image is still over 10 MB after compression. Choose another photo.');
  }

  // The manipulator was asked to emit JPEG. Some browsers omit the Blob MIME
  // type for blob URLs, so restore that known output type before multipart.
  const imageType = image.type.trim().toLowerCase() || 'image/jpeg';
  if (!SUPPORTED_IMAGE_TYPES.has(imageType)) {
    throw new Error('The edited image format is not supported. Choose a JPEG, PNG, or WebP photo.');
  }
  return image.type === imageType ? image : new Blob([image], { type: imageType });
}

/**
 * The upload part for a photo on iOS and Android. Expo's `fetch` cannot send React Native's old
 * `{ uri, name, type }` form-data object ("Unsupported FormDataPart implementation"); it takes a
 * file-like part with a name, a type and `bytes()`, which this builds from the edited image file.
 */
export function nativeReceiptPart(file: { bytes(): Promise<Uint8Array> }, name: string, type: string): Blob {
  return { name, type, bytes: () => file.bytes() } as unknown as Blob;
}
