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

interface StoredIntentRecord {
  intent: {
    intentId: string;
    action: string;
    correlationId: string;
    actorId?: string;
    profileType?: string;
    metadata?: Record<string, unknown>;
  };
  status: string;
  reasonCode?: string;
}

export interface MockGatewayState {
  lastRequest?: {
    method?: string;
    url?: string;
    headers: IncomingMessage['headers'];
    body: unknown;
  };
  intents: Map<string, StoredIntentRecord>;
  replays: Set<string>;
}

function buildAuditEvents(record: StoredIntentRecord | undefined, correlationId: string, intentId: string) {
  if (!record) {
    return [
      {
        eventId: 'audit-1',
        correlationId,
        intentId,
        type: 'INTENT_SUBMITTED',
        timestamp: '2026-09-11T07:00:00.000Z',
      },
    ];
  }

  return [
    {
      eventId: `${intentId}-submitted`,
      correlationId,
      intentId,
      type: 'INTENT_SUBMITTED',
      timestamp: '2026-09-11T07:00:00.000Z',
      payload: {
        status: 'PENDING',
        profileType: record.intent.profileType,
        actorId: record.intent.actorId,
      },
    },
    {
      eventId: `${intentId}-${record.status.toLowerCase()}`,
      correlationId,
      intentId,
      type: `INTENT_${record.status}`,
      timestamp: '2026-09-11T07:01:00.000Z',
      reasonCode: record.reasonCode,
      payload: {
        status: record.status,
        profileType: record.intent.profileType,
        actorId: record.intent.actorId,
      },
    },
  ];
}

export async function startMockGateway() {
  const state: MockGatewayState = {
    intents: new Map(),
    replays: new Set(),
  };

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    let body: unknown;
    try {
      body = await readJson(request);
    } catch {
      response.statusCode = 400;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ message: 'Malformed JSON body', reasonCode: 'INVALID_JSON' }));
      return;
    }

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
      const intent = (body as { intent: StoredIntentRecord['intent'] }).intent;
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

      const metadata = intent.metadata ?? {};
      const status = typeof metadata.mockStatus === 'string' ? metadata.mockStatus.toUpperCase() : 'PENDING';
      const reasonCode = typeof metadata.mockReasonCode === 'string' ? metadata.mockReasonCode : undefined;
      state.intents.set(intent.intentId, { intent, status, reasonCode });
      response.statusCode = 201;
      response.end(JSON.stringify({ accepted: true, intent, status, reasonCode, correlationId: intent.correlationId }));
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/v1/intents/')) {
      const intentId = url.pathname.split('/').pop() ?? '';
      const record = state.intents.get(intentId);
      response.end(JSON.stringify({
        intent: record?.intent,
        status: record?.status ?? 'PENDING',
        reasonCode: record?.reasonCode,
        correlationId: record?.intent.correlationId,
      }));
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

    if (request.method === 'POST' && url.pathname.endsWith('/suspend')) {
      const agentId = url.pathname.split('/')[3] ?? '';
      response.end(JSON.stringify({ suspended: true, agentId }));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/v1/audit-events') {
      const intentId = url.searchParams.get('intentId') ?? [...state.intents.keys()][0] ?? 'intent-1';
      const record = state.intents.get(intentId)
        ?? [...state.intents.values()].find((candidate) => candidate.intent.correlationId === url.searchParams.get('correlationId'));
      const effectiveCorrelationId = correlationId ?? url.searchParams.get('correlationId') ?? record?.intent.correlationId ?? 'corr-default';
      response.end(JSON.stringify(buildAuditEvents(record, effectiveCorrelationId, intentId)));
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
