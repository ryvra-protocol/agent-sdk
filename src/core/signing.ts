import { createHash, createHmac } from 'node:crypto';
import type { RequestSignerConfig } from './types.js';

export class RequestSigner {
  constructor(private readonly config: RequestSignerConfig) {}

  sign(method: string, path: string, body: unknown) {
    const timestamp = (this.config.clock ?? (() => new Date()))().toISOString();
    const payload = body === undefined ? '' : JSON.stringify(body);
    const payloadHash = createHash('sha256').update(payload).digest('hex');
    const canonical = [method.toUpperCase(), path, timestamp, payloadHash].join('\n');
    const signature = createHmac('sha256', this.config.secret).update(canonical).digest('hex');

    return {
      'x-ryvra-key-id': this.config.keyId,
      'x-ryvra-signature': signature,
      'x-ryvra-timestamp': timestamp,
    };
  }
}
