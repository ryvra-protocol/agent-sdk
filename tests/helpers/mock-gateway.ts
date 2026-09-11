import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) as unknown : undefined;
}

export interface MockGatewayState {
  lastRequest?: {
    method?: string;
    url?: string;
    headers: IncomingMessage['headers'];
    body: unknown;
  };
  intents: Map<string, unknown>;
  replays: Set<string>;
}

export async function startMockGateway() {
  const state: MockGatewayState = {
    intents: new Map(),
    replays: new Set(),
  };

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const body = await readJson(request);
    state.lastRequest = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body,
    };

    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const correlationId = request.headers['x-correlation-id'] as string | undefined;
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    response.setHeader('content-type', 'application/json');

    if (request.method === 'POST' && url.pathname === '/v1/intents') {
      const intent = (body as { intent: { intentId: string; action: string; correlationId: string } }).intent;
      if (idempotencyKey && state.replays.has(idempotencyKey)) {
        response.statusCode = 409;
        response.end(JSON.stringify({
          message: 'Replay detected',
          reasonCode: 'REPLAY_DETECTED',
          intentId: intent.intentId,
          correlationId: intent.correlationId,
        }));
        return;
      }

      if (intent.action === 'TRADE') {
        response.statusCode = 403;
        response.end(JSON.stringify({
          message: 'Trade denied by policy',
          reasonCode: 'POLICY_DENIED',
          intentId: intent.intentId,
          correlationId: intent.correlationId,
        }));
        return;
      }

      if (idempotencyKey) {
        state.replays.add(idempotencyKey);
      }

      state.intents.set(intent.intentId, intent);
      response.statusCode = 201;
      response.end(JSON.stringify({ accepted: true, intent }));
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/v1/intents/')) {
      const intentId = url.pathname.split('/').pop() ?? '';
      response.end(JSON.stringify({ intent: state.intents.get(intentId), status: 'PENDING' }));
      return;
    }

    if (request.method === 'POST' && url.pathname.endsWith('/approve')) {
      const intentId = url.pathname.split('/')[3] ?? '';
      response.end(JSON.stringify({ approved: true, intentId }));
      return;
    }

    if (request.method === 'POST' && url.pathname.endsWith('/cancel')) {
      const intentId = url.pathname.split('/')[3] ?? '';
      response.end(JSON.stringify({ cancelled: true, intentId }));
      return;
    }

    if (request.method === 'GET' && url.pathname.endsWith('/status')) {
      const agentId = url.pathname.split('/')[3] ?? '';
      response.end(JSON.stringify({ agentId, status: 'ACTIVE' }));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/v1/audit-events') {
      response.end(JSON.stringify([
        {
          eventId: 'audit-1',
          correlationId: correlationId ?? url.searchParams.get('correlationId') ?? 'corr-default',
          intentId: url.searchParams.get('intentId') ?? 'intent-1',
          type: 'INTENT_SUBMITTED',
          timestamp: '2026-09-11T07:00:00.000Z',
        },
        {
          eventId: 'audit-2',
          correlationId: correlationId ?? url.searchParams.get('correlationId') ?? 'corr-default',
          intentId: url.searchParams.get('intentId') ?? 'intent-1',
          type: 'INTENT_PENDING',
          timestamp: '2026-09-11T07:01:00.000Z',
        },
      ]));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ message: 'Not found', reasonCode: 'NOT_FOUND' }));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    state,
    async close() {
      server.close();
      await once(server, 'close');
    },
  };
}
