import { AuthenticationError } from './errors.js';
import type { TokenProvider } from './types.js';

export class AuthClient {
  constructor(private readonly tokenProvider: TokenProvider) {}

  async getAuthorizationHeader(): Promise<string> {
    const token = typeof this.tokenProvider === 'function'
      ? await this.tokenProvider()
      : this.tokenProvider;

    if (!token) {
      throw new AuthenticationError('Missing gateway auth token', {
        reasonCode: 'AUTH_TOKEN_MISSING',
        status: 401,
      });
    }

    return 'Bearer ' + token;
  }
}
