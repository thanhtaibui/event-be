import { applyDecorators } from '@nestjs/common';
import { Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_POLICY_MESSAGE =
  'Password must be 12-64 printable ASCII characters with no spaces and include at least one uppercase letter, one lowercase letter, one number, and one special character.';

export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[!-~]{12,64}$/;

export function IsStrongPassword() {
  return applyDecorators(
    MinLength(12, { message: PASSWORD_POLICY_MESSAGE }),
    MaxLength(64, { message: PASSWORD_POLICY_MESSAGE }),
    Matches(STRONG_PASSWORD_REGEX, { message: PASSWORD_POLICY_MESSAGE }),
  );
}

export function isStrongPassword(password: string): boolean {
  return typeof password === 'string' && STRONG_PASSWORD_REGEX.test(password);
}

export function assertStrongPassword(password: string, fieldName = 'Password') {
  if (!isStrongPassword(password)) {
    throw new Error(`${fieldName}: ${PASSWORD_POLICY_MESSAGE}`);
  }
}
