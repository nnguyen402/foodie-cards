import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { createSupabaseDependencies } from './auth.js';
import { createReceiptDependencies } from './receipts/store.js';

export function startServer(): ReturnType<ReturnType<typeof createApp>['listen']> {
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp(createSupabaseDependencies(), createReceiptDependencies(), process.env.CORS_ALLOWED_ORIGINS);
  return app.listen(port, () => {
    process.stdout.write(`Foodie Cards API listening on port ${port}\n`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
