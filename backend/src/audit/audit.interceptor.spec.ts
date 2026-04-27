import { redactSensitive } from './audit.interceptor';

/**
 * Pure-function tests for the audit redactor. Covers the two distinct
 * redaction policies (full-redact vs partial-mask) and the recursive
 * traversal so nested payloads are still scrubbed.
 */
describe('redactSensitive', () => {
  it('returns null/undefined unchanged', () => {
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive(undefined)).toBeUndefined();
  });

  it('passes primitives through unchanged', () => {
    expect(redactSensitive('hello')).toBe('hello');
    expect(redactSensitive(42)).toBe(42);
    expect(redactSensitive(true)).toBe(true);
  });

  it('fully redacts credential keys', () => {
    const input = {
      email: 'user@example.com',
      password: 'p@ssw0rd!',
      new_password: 'NewStrong9',
      confirm_password: 'NewStrong9',
      current_password: 'old',
      password_hash: '$2b$10$abcdef',
      token: 'eyJhbGciOiJ...',
      invite_token: '1234-uuid',
      fcm_token: 'firebase-token',
      google_access_token: 'ya29.xxx',
      google_refresh_token: '1//refresh',
      secret: 'shh',
    };
    const out = redactSensitive(input);
    expect(out.email).toBe('user@example.com');
    expect(out.password).toBe('[REDACTED]');
    expect(out.new_password).toBe('[REDACTED]');
    expect(out.confirm_password).toBe('[REDACTED]');
    expect(out.current_password).toBe('[REDACTED]');
    expect(out.password_hash).toBe('[REDACTED]');
    expect(out.token).toBe('[REDACTED]');
    expect(out.invite_token).toBe('[REDACTED]');
    expect(out.fcm_token).toBe('[REDACTED]');
    expect(out.google_access_token).toBe('[REDACTED]');
    expect(out.google_refresh_token).toBe('[REDACTED]');
    expect(out.secret).toBe('[REDACTED]');
  });

  it('partial-masks PII keys keeping the last 4 chars', () => {
    const out = redactSensitive({
      bank_account_no: '1234567890123456',
      bank_ifsc: 'HDFC0001234',
      pan: 'ABCDE1234F',
      pan_no: 'PQRST5678U',
      aadhaar: '111122223333',
      aadhaar_no: '999988887777',
      pf_uan_no: '123456789012',
      esic_no: '1234567890',
    });
    expect(out.bank_account_no).toBe('************3456');
    expect(out.bank_ifsc).toBe('*******1234');
    expect(out.pan).toBe('******234F');
    expect(out.pan_no).toBe('******678U');
    expect(out.aadhaar).toBe('********3333');
    expect(out.aadhaar_no).toBe('********7777');
    expect(out.pf_uan_no).toBe('********9012');
    expect(out.esic_no).toBe('******7890');
  });

  it('uses **** when the masked value is shorter than 5 chars', () => {
    expect(redactSensitive({ pan: '' }).pan).toBe('****');
    expect(redactSensitive({ pan: '1234' }).pan).toBe('****');
    expect(redactSensitive({ bank_account_no: 'AB' }).bank_account_no).toBe(
      '****',
    );
  });

  it('preserves null / undefined for masked keys', () => {
    expect(redactSensitive({ pan: null }).pan).toBeNull();
    expect(redactSensitive({ bank_ifsc: undefined }).bank_ifsc).toBeUndefined();
  });

  it('descends into nested objects + arrays', () => {
    const input = {
      user: {
        name: 'Alice',
        password: 'top',
        bank: { bank_account_no: '11112222333344445555' },
      },
      audit: [
        { token: 'a', note: 'x' },
        { token: 'b', note: 'y' },
      ],
    };
    const out = redactSensitive(input);
    expect(out.user.name).toBe('Alice');
    expect(out.user.password).toBe('[REDACTED]');
    expect(out.user.bank.bank_account_no).toBe('****************5555');
    expect(out.audit).toHaveLength(2);
    expect(out.audit[0].token).toBe('[REDACTED]');
    expect(out.audit[0].note).toBe('x');
    expect(out.audit[1].token).toBe('[REDACTED]');
  });

  it('does not mutate the input', () => {
    const input = { password: 'a', bank_account_no: '1234567890' };
    redactSensitive(input);
    expect(input.password).toBe('a');
    expect(input.bank_account_no).toBe('1234567890');
  });
});
