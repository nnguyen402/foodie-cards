import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { createSupabaseDependencies } from './auth.js';

export function startServer(): ReturnType<ReturnType<typeof createApp>['listen']> {
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp(createSupabaseDependencies());
  return app.listen(port, () => {
    process.stdout.write(`Foodie Cards API listening on port ${port}\n`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
