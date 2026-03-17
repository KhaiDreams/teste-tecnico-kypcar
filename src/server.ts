import { env } from './config/env';
import { buildApp } from './app';

async function start(): Promise<void> {
  const { app } = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });
  } catch (error) {
    app.log.fatal(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Unable to start server',
    );

    process.exit(1);
  }
}

void start();
