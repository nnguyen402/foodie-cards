import { access, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractReceipt } from './extract.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const mimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function loadServerEnvironment(): Promise<void> {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDirectory, '../../.env');
  try {
    await access(envPath);
    process.loadEnvFile(envPath);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }

  const missingSettings = ['GEMINI_API_KEY', 'GEMINI_MODEL'].filter((name) => !process.env[name]);
  if (missingSettings.length > 0) {
    throw new Error(`Missing required settings: ${missingSettings.join(', ')}. Set them in server/.env.`);
  }
}

async function main(): Promise<void> {
  const imagePath = process.argv[2];
  if (!imagePath) {
    throw new Error('Usage: node --env-file-if-exists=server\\.env --import tsx server\\src\\receipts\\try-extract.ts <image-path>');
  }

  await loadServerEnvironment();

  const mimeType = mimeTypes[extname(imagePath).toLocaleLowerCase()];
  if (!mimeType) throw new Error('Image path must refer to a .jpg, .jpeg, .png, or .webp file.');

  const details = await stat(imagePath);
  if (!details.isFile() || details.size === 0 || details.size > MAX_IMAGE_BYTES) {
    throw new Error('Receipt image must be a non-empty file no larger than 10 MB.');
  }

  const bytes = await readFile(imagePath);
  const draft = await extractReceipt({ bytes, mimeType });
  process.stdout.write(`${JSON.stringify(draft, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Receipt extraction failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
