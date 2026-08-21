import { AuthService } from './auth.service';

const options = {
  keycloakUrl: 'http://localhost:8080',
  realm: 'finance',
  clientId: 'finance-web',
  clientSecret: 'dev-secret',
  bffPublicUrl: 'http://localhost:3002',
  webUrl: 'http://localhost:3000',
};

describe('AuthService', () => {
  describe('validateReturnTo', () => {
    const service = new AuthService(options);

    it('accepts relative paths', () => {
      expect(service.validateReturnTo('/contas')).toBe('/contas');
      expect(service.validateReturnTo('/transacoes?page=2')).toBe('/transacoes?page=2');
    });

    it('defaults to / when missing', () => {
      expect(service.validateReturnTo(undefined)).toBe('/');
      expect(service.validateReturnTo('')).toBe('/');
    });

    it('rejects protocol-relative URLs', () => {
      expect(service.validateReturnTo('//evil.com')).toBe('/');
    });

    it('rejects absolute URLs', () => {
      expect(service.validateReturnTo('https://evil.com')).toBe('/');
      expect(service.validateReturnTo('/redirect?to=https://ok.com')).toBe('/');
    });

    it('rejects non-slash-prefixed values', () => {
      expect(service.validateReturnTo('contas')).toBe('/');
    });
  });

  describe('createAuthorizationUrl', () => {
    it('throws ProviderUnavailableError when discovery fails', async () => {
      const service = new AuthService({ ...options, keycloakUrl: 'http://127.0.0.1:1' });
      await expect(service.createAuthorizationUrl('/')).rejects.toThrow(
        'OIDC provider unavailable',
      );
    });
  });

  describe('handleCallback', () => {
    it('rejects callback with provider error param', async () => {
      const service = new AuthService(options);
      const url = new URL('http://localhost:3002/auth/callback?error=access_denied');
      await expect(service.handleCallback(url)).rejects.toThrow('Provider returned an error');
    });

    it('rejects callback without state (direct access)', async () => {
      const service = new AuthService(options);
      const url = new URL('http://localhost:3002/auth/callback?code=abc');
      await expect(service.handleCallback(url)).rejects.toThrow('Missing state');
    });

    it('rejects unknown state', async () => {
      const service = new AuthService(options);
      const url = new URL('http://localhost:3002/auth/callback?code=abc&state=unknown');
      await expect(service.handleCallback(url)).rejects.toThrow('Unknown or expired state');
    });
  });
});
