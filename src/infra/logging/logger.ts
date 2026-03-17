import type { FastifyServerOptions } from 'fastify';

import { env } from '../../config/env';

const loggerOptions: FastifyServerOptions['logger'] = {
  level: env.LOG_LEVEL,
};

if (env.NODE_ENV === 'development') {
  Object.assign(loggerOptions, {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: true,
      },
    },
  });
}

export const fastifyLoggerOptions = loggerOptions;
