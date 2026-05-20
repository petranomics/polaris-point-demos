-- Email-invite flow for admin/ops users.
--
-- Seniors create an invitation (email + role); the API generates a unique
-- token, emails an accept link, and the recipient sets their name + password
-- to activate a row in `users`. Replaces the old localStorage self-signup and
-- hardcoded senior list.

CREATE TABLE IF NOT EXISTS invitations (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'junior',   -- 'junior' | 'senior'
  full_name   TEXT,                              -- optional, prefilled on accept
  token       TEXT NOT NULL UNIQUE,
  invited_by  TEXT,                              -- username (email) of the senior who sent it
  status      TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'accepted' | 'revoked' | 'expired'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_token  ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email  ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
