export const customFetch = Symbol('customFetch');

export class Configuration {}

export async function discovery(): Promise<Configuration> {
  throw new Error('openid-client stub: discovery not available in unit tests');
}

export function randomPKCECodeVerifier(): string {
  return 'stub-code-verifier';
}

export async function calculatePKCECodeChallenge(): Promise<string> {
  return 'stub-code-challenge';
}

export function randomState(): string {
  return 'stub-state';
}

export function randomNonce(): string {
  return 'stub-nonce';
}

export function buildAuthorizationUrl(): URL {
  return new URL('http://keycloak.stub/auth');
}

export async function authorizationCodeGrant(): Promise<never> {
  throw new Error('openid-client stub: authorizationCodeGrant not available in unit tests');
}

export async function refreshTokenGrant(): Promise<never> {
  throw new Error('openid-client stub: refreshTokenGrant not available in unit tests');
}

export function buildEndSessionUrl(): URL {
  return new URL('http://keycloak.stub/logout');
}

export function allowInsecureRequests(): void {}
