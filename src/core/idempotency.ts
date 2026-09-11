import { randomUUID } from 'node:crypto';

export function createIdempotencyKey(prefix = 'intent'): string {
  return `${prefix}_${randomUUID()}`;
}
