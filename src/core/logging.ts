const SENSITIVE_KEYS = ['authorization', 'token', 'secret', 'signature', 'apiKey', 'privateKey'];

function shouldRedact(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((candidate) => normalized.includes(candidate.toLowerCase()));
}

export function redactSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveFields(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        shouldRedact(key) ? '[REDACTED]' : redactSensitiveFields(entryValue),
      ]),
    );
  }

  return value;
}
