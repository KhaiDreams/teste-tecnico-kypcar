import { z } from 'zod';

export const webhookPayloadSchema = z.object({
  plate: z
    .string()
    .min(7)
    .max(8)
    .regex(/^[A-Za-z0-9-]+$/),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
