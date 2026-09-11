import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as sdk from '../src/index.js';
import { AgentGatewayClient } from '../src/index.js';

const sourceFiles = readdirSync(new URL('../src', import.meta.url), { recursive: true }).map(String);

describe('security guardrails', () => {
  it('does not expose direct execution or custody clients', () => {
    expect(Object.keys(sdk).some((key) => /(Execution(Client|Api)?|Wallet|Rpc)/i.test(key))).toBe(false);
    expect(sourceFiles.some((file) => /execution|wallet|rpc/i.test(file))).toBe(false);
  });

  it('blocks non-gateway execution access by design', () => {
    const client = new AgentGatewayClient({
      baseUrl: 'https://agent-gateway.ryvra.example',
      auth: 'token',
      signing: { keyId: 'key', secret: 'secret' },
    });

    expect((client as unknown as Record<string, unknown>).requestJson).toBeUndefined();
    expect(() => (client as unknown as Record<string, (...args: unknown[]) => unknown>).requestJson('/v1/payments/execute')).toThrow(TypeError);
  });
});
