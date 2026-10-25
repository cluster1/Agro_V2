import { UnauthorizedException } from '@nestjs/common';

/**
 * The presented refresh token was consumed a moment ago (two tabs, a retried
 * request). It is refused, but unlike real reuse it must NOT revoke the user's
 * sessions nor clear the cookie the winning request just set.
 */
export class RefreshRaceException extends UnauthorizedException {
  constructor() {
    super('Invalid refresh token');
  }
}
