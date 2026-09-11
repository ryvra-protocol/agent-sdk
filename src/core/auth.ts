import type { TokenProvider } from './types.js';

export class AuthClient {
  constructor(private readonly tokenProvider: TokenProvider) {}

  async getAuthorizationHeader(): Promise<string> {
    const token = typeof this.tokenProvider === 'function'
      ? await this.tokenProvider()
      : this.tokenProvider;

    if (!token) {
      throw new Error('Missing gateway auth token');
    }

    return `******;
  }
}
