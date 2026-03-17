import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode ?? 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    if (isClientError) {
      return reply.status(statusCode).send({ message: error.message });
    }

    request.log.error(
      {
        err: {
          message: error.message,
          name: error.name,
        },
      },
      'Unhandled application error',
    );

    return reply.status(500).send({
      message: 'Internal Server Error',
    });
  });
}
