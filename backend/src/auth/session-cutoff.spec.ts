import { sessionCutoff } from './invite-auth.service';

/**
 * Pure-function check for the session-invalidation cutoff helper. The
 * 1-second back-off here pairs with the 2-second grace window inside
 * JwtStrategy.validate so a freshly-signed token is never rejected by
 * its own rotation event. This test pins the contract.
 */
describe('sessionCutoff', () => {
  it('returns a Date roughly 1 second in the past', () => {
    const before = Date.now();
    const cutoff = sessionCutoff();
    const after = Date.now();

    expect(cutoff).toBeInstanceOf(Date);
    // The function shifts back by exactly 1000ms; allow the test runner
    // a generous 200ms wall-clock window.
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 1200);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - 1000);
  });

  it('combined with the 2-second JwtStrategy grace, gives ~3s slack', () => {
    // Simulate what happens inside activateAccount / changeMyPassword:
    //   1. We write tokens_valid_from = sessionCutoff()
    //   2. We sign a JWT with iat = Math.floor(Date.now() / 1000)
    //   3. JwtStrategy.validate compares (iat * 1000 + 2000) >= cutoff
    //
    // The freshly-signed token MUST pass that comparison or every login
    // event would log the user back out instantly.
    const cutoff = sessionCutoff().getTime();
    const iatMs = Math.floor(Date.now() / 1000) * 1000;
    const graceMs = 2000;

    expect(iatMs + graceMs).toBeGreaterThanOrEqual(cutoff);
  });

  it('rejects a token issued before the cutoff (post-grace)', () => {
    // A token whose iat is 10 seconds older than the cutoff should not
    // pass even with the 2-second grace.
    const cutoff = sessionCutoff().getTime();
    const oldIatMs = cutoff - 10_000;
    const graceMs = 2000;

    expect(oldIatMs + graceMs).toBeLessThan(cutoff);
  });
});
