import { isStrongPassword } from './password-policy';

describe('password policy', () => {
  it.each([
    'abc123',
    'password123',
    'Password123',
    'password123!',
    'PASSWORD123!',
    'Password!!!!',
  ])('rejects weak password %s', (password) => {
    expect(isStrongPassword(password)).toBe(false);
  });

  it.each([
    'Buithanhtai9#',
    'EventixAdmin2026!',
    'StrongPass123@',
    'MySecure2026#Event',
  ])('accepts strong password %s', (password) => {
    expect(isStrongPassword(password)).toBe(true);
  });

  it.each(['#', '@', '!', '$', '%', '&', '*', '_'])(
    'accepts special character %s',
    (character) => {
      expect(isStrongPassword(`StrongPass123${character}`)).toBe(true);
    },
  );

  it('rejects whitespace instead of silently trimming', () => {
    expect(isStrongPassword(' StrongPass123#')).toBe(false);
    expect(isStrongPassword('StrongPass123# ')).toBe(false);
  });
});
