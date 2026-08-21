import { signSessionId, verifySessionCookie } from './cookie.util';

const SECRET = 'test-secret-with-at-least-32-chars!!';

describe('cookie.util', () => {
  it('signs and verifies a session id', () => {
    const signed = signSessionId('abc-123', SECRET);
    expect(verifySessionCookie(signed, SECRET)).toBe('abc-123');
  });

  it('rejects a tampered session id', () => {
    const signed = signSessionId('abc-123', SECRET);
    const tampered = signed.replace('abc-123', 'abc-124');
    expect(verifySessionCookie(tampered, SECRET)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const signed = signSessionId('abc-123', SECRET);
    expect(verifySessionCookie(`${signed}x`, SECRET)).toBeNull();
  });

  it('rejects a value signed with another secret', () => {
    const signed = signSessionId('abc-123', 'another-secret-with-at-least-32-chars');
    expect(verifySessionCookie(signed, SECRET)).toBeNull();
  });

  it('rejects malformed values', () => {
    expect(verifySessionCookie('no-separator', SECRET)).toBeNull();
    expect(verifySessionCookie('', SECRET)).toBeNull();
  });
});
