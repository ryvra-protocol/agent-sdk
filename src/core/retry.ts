import { AuthorizationError, AuthenticationError } from './errors.js';
import type { RetryOptions } from './types.js';

const DEFAULT_RETRYABLE_CODES = [408, 425, 429, 500, 502, 503, 504];

export interface RetryContext {
  attempt: number;
  error?: unknown;
  status?: number;
}

export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
  shouldRetry?: (error: unknown, attempt: number) => boolean,
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 150;
  const maxDelayMs = options.maxDelayMs ?? 1_500;
  const retryableStatusCodes = options.retryableStatusCodes ?? DEFAULT_RETRYABLE_CODES;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : undefined;
      const hardStop = error instanceof AuthenticationError || error instanceof AuthorizationError;
      const retryableStatus = status !== undefined && retryableStatusCodes.includes(status);
      const canRetry = !hardStop && attempt < maxAttempts && (shouldRetry ? shouldRetry(error, attempt) : retryableStatus);

      if (!canRetry) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Retry execution fell through unexpectedly');
}
