import { URL } from 'node:url';
import {
  AuthenticationError,
  AuthorizationError,
  CapabilityMismatchError,
  GatewayError,
  GatewayUnavailableError,
  PolicyDeniedError,
  RateLimitError,
  ReplayDetectedError,
  RiskDeniedError,
  ValidationError,
} from './errors.js';
import { redactSensitiveFields } from './logging.js';
import { executeWithRetry } from './retry.js';
import type { GatewayClientConfig, GatewayErrorPayload, RequestContext } from './types.js';
import { AuthClient } from './auth.js';
import { RequestSigner } from './signing.js';

const ALLOWED_PATH_PREFIXES = [
  '/v1/intents',
  '/v1/agents',
  '/v1/mandates',
  '/v1/policy-decisions',
  '/v1/risk-decisions',
  '/v1/audit-events',
];

function isAllowedPath(path: string): boolean {
  return ALLOWED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
}

export function mapGatewayError(status: number, payload: GatewayErrorPayload = {}): GatewayError {
  const message = payload.message ?? `Agent gateway request failed with status ${status}`;
  const metadata = {
    reasonCode: payload.reasonCode,
    intentId: payload.intentId,
    correlationId: payload.correlationId,
    details: payload.details,
    status,
  };

  if (status === 401) return new AuthenticationError(message, metadata);
  if (status === 429) return new RateLimitError(message, metadata);
  if (status === 409 && payload.reasonCode === 'REPLAY_DETECTED') return new ReplayDetectedError(message, metadata);
  if (status === 503 || status === 502 || status === 504) return new GatewayUnavailableError(message, metadata);
  if (status === 403 && payload.reasonCode === 'POLICY_DENIED') return new PolicyDeniedError(message, metadata);
  if (status === 403 && payload.reasonCode === 'RISK_DENIED') return new RiskDeniedError(message, metadata);
  if (status === 403 && payload.reasonCode === 'CAPABILITY_MISMATCH') return new CapabilityMismatchError(message, metadata);
  if (status === 403) return new AuthorizationError(message, metadata);
  if (status === 400 || status === 422) return new ValidationError(message, metadata);
  return new GatewayError(message, metadata);
}

export class GatewayTransport {
  readonly #baseUrl: URL;
  readonly #authClient: AuthClient;
  readonly #signer: RequestSigner;
  readonly #fetchImpl: typeof fetch;
  readonly #timeoutMs: number;
  readonly #retry;
  readonly #logger;

  constructor(private readonly config: GatewayClientConfig) {
    this.#baseUrl = new URL(config.baseUrl);
    this.#authClient = new AuthClient(config.auth);
    this.#signer = new RequestSigner(config.signing);
    this.#fetchImpl = config.fetchImplementation ?? fetch;
    this.#timeoutMs = config.timeoutMs ?? 8_000;
    this.#retry = config.retry;
    this.#logger = config.logger;
  }

  async get<T>(path: string, context: RequestContext = {}): Promise<T> {
    return this.#requestJson<T>('GET', path, undefined, context, true);
  }

  async post<T>(path: string, body: unknown, context: RequestContext = {}, safeToRetry = false): Promise<T> {
    return this.#requestJson<T>('POST', path, body, context, safeToRetry);
  }

  async #requestJson<T>(method: string, path: string, body: unknown, context: RequestContext, safeToRetry: boolean): Promise<T> {
    if (!isAllowedPath(path)) {
      throw new ValidationError('Blocked non-gateway execution path', {
        reasonCode: 'NON_GATEWAY_PATH_BLOCKED',
        correlationId: context.correlationId,
      });
    }

    return executeWithRetry(async () => {
      const url = new URL(path, this.#baseUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

      try {
        const authorization = await this.#authClient.getAuthorizationHeader();
        const headers: Record<string, string> = {
          accept: 'application/json',
          authorization,
          ...this.#signer.sign(method, url.pathname, body),
        };

        if (context.correlationId) {
          headers['x-correlation-id'] = context.correlationId;
        }

        if (context.idempotencyKey) {
          headers['idempotency-key'] = context.idempotencyKey;
        }

        const hasBody = body !== undefined;
        if (hasBody) {
          headers['content-type'] = 'application/json';
        }

        this.#logger?.debug?.('gateway request', redactSensitiveFields({ method, path, headers, body }));

        const response = await this.#fetchImpl(url, {
          method,
          headers,
          body: hasBody ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        const text = await response.text();
        const payload = text ? JSON.parse(text) as unknown : undefined;

        if (!response.ok) {
          throw mapGatewayError(response.status, (payload ?? {}) as GatewayErrorPayload);
        }

        return payload as T;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new GatewayUnavailableError('Agent gateway request timed out', {
            reasonCode: 'GATEWAY_TIMEOUT',
            correlationId: context.correlationId,
            status: 504,
          });
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }, this.#retry, (error) => safeToRetry && error instanceof GatewayError && typeof error.status === 'number');
  }
}
