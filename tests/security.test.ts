import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as sdk from '../src/index.js';
import { AgentGatewayClient, GatewayTransport, ValidationError, redactSensitiveFields } from '../src/index.js';

const sourceFiles = readdirSync(new URL('../src', import.meta.url), { recursive: true }).map(String);

describe('security guardrails', () => {
  it('does not expose direct execution or custody clients', () => {
    expect(Object.keys(sdk).some((key) => /(Execution(Client|Api)?|Wallet|Rpc)/i.test(key))).toBe(false);
    expect(sourceFiles.some((file) => /execution|wallet|rpc/i.test(file))).toBe(false);
  });

  it('blocks non-gateway execution access by design', async () => {
    const client = new AgentGatewayClient({
      baseUrl: 'https://agent-gateway.ryvra.example',
      auth: 'token',
      signing: { keyId: 'key', secret: 'secret' },
    });

    expect((client as unknown as Record<string, unknown>).requestJson).toBeUndefined();
    expect(() => (client as unknown as Record<string, (...args: unknown[]) => unknown>).requestJson('/v1/payments/execute')).toThrow(TypeError);

    const transport = new GatewayTransport({
      baseUrl: 'https://agent-gateway.ryvra.example',
      auth: 'token',
      signing: { keyId: 'key', secret: 'secret' },
    });

    await expect(transport.post('/v1/payments/execute', {}, { correlationId: 'corr-bypass' })).rejects.toMatchObject({
      reasonCode: 'NON_GATEWAY_PATH_BLOCKED',
    } satisfies Partial<ValidationError>);
  });

  it('redacts sensitive fields in nested log payloads', () => {
    expect(redactSensitiveFields({
      authorization: 'token',
      metadata: {
        signingSecret: 'secret',
        profile: {
          apiKey: 'key',
        },
      },
    })).toEqual({
      authorization: '[REDACTED]',
      metadata: {
        signingSecret: '[REDACTED]',
        profile: {
          apiKey: '[REDACTED]',
        },
      },
    });
  });
});
