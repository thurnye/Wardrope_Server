import { env } from './config/env';
import { createApp } from './Wardrope.API/server/app';
import { createApplicationRuntime } from './Wardrope.API/server/app-runtime';

const SHUTDOWN_TIMEOUT_MS = 10_000;

function logStartupFailure(error: unknown): void {
  const diagnostic = {
    level: 'error',
    message: 'Wardrope server failed to start',
    ...(env.nodeEnv === 'development' && error instanceof Error
      ? { errorName: error.name, errorMessage: error.message }
      : {}),
  };

  console.error(JSON.stringify(diagnostic));
}

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
  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', message: 'Wardrope server shutting down', signal }));

    const forceCloseTimer = setTimeout(() => {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Wardrope server forced open connections to close after shutdown timeout',
        }),
      );
      server.closeAllConnections();
    }, SHUTDOWN_TIMEOUT_MS);
    forceCloseTimer.unref();

    server.close(async (error) => {
      clearTimeout(forceCloseTimer);

      try {
        await runtime.shutdown();
      } catch {
        console.error(JSON.stringify({ level: 'error', message: 'Wardrope runtime shutdown failed' }));
        process.exitCode = 1;
      }

      if (error) {
        console.error(JSON.stringify({ level: 'error', message: 'Wardrope HTTP server shutdown failed' }));
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

void start().catch((error: unknown) => {
  logStartupFailure(error);
  process.exitCode = 1;
});
