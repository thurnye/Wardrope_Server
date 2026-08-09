import { env } from './config/env';
import { createApp } from './Wardrope.API/server/app';
import { createApplicationRuntime } from './Wardrope.API/server/app-runtime';

async function start(): Promise<void> {
  const runtime = await createApplicationRuntime();
  const app = createApp(runtime.apiRouter);
  const server = app.listen(env.port, () => {
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Wardrope server started',
        port: env.port,
        environment: env.nodeEnv,
      }),
    );
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', message: 'Wardrope server shutting down', signal }));

    server.close(async (error) => {
      try {
        await runtime.shutdown();
      } finally {
        if (error) {
          console.error(JSON.stringify({ level: 'error', message: error.message }));
          process.exitCode = 1;
        }
      }
    });
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

void start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  console.error(JSON.stringify({ level: 'error', message: 'Wardrope server failed to start', error: message }));
  process.exitCode = 1;
});
