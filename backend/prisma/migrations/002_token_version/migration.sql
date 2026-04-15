-- Add token_version for refresh-token revocation on password change.
--
-- WHY: Previously changePassword() updated passwordHash only. Refresh tokens
-- signed before the change remained valid for their full 7-day window. A
-- stolen session couldn't be kicked out by rotating the password. Adding
-- tokenVersion lets us stamp every JWT and reject any token whose stamp
-- no longer matches the user's current value.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "tokenVersion" INT NOT NULL DEFAULT 0;
