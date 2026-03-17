import type { FastifyInstance } from 'fastify';

import type { ProcessedEventStore } from '../../../core/ports/repositories';

interface DebugRouteDeps {
  processedEventStore: ProcessedEventStore;
}

export async function debugRoute(app: FastifyInstance, deps: DebugRouteDeps): Promise<void> {
  app.get('/debug/events/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const record = await deps.processedEventStore.get(params.id);

    if (!record) {
      return reply.status(404).send({
        message: 'Event not found',
      });
    }

    return reply.send(record);
  });
}
