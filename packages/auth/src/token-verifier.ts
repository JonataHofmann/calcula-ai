export interface VerifiedToken {
  sub: string;
  payload: Record<string, unknown>;
}

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken>;
}
