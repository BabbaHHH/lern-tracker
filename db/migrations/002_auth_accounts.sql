-- AUTH-A additive schema, generated from the pinned Better Auth 1.7.7 table contract.
CREATE TABLE public."stex_auth_user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "twoFactorEnabled" boolean DEFAULT false,
  "stexAccountId" text,
  "invitationId" text
);
CREATE TABLE public."stex_auth_session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES public."stex_auth_user"("id") ON DELETE CASCADE,
  "stexGeneration" integer,
  "factorVerifiedAt" timestamptz
);
CREATE INDEX ON public."stex_auth_session"("userId");
CREATE TABLE public."stex_auth_account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES public."stex_auth_user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);
CREATE INDEX ON public."stex_auth_account"("userId");
CREATE TABLE public."stex_auth_verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);
CREATE INDEX ON public."stex_auth_verification"("identifier");
CREATE TABLE public."stex_auth_two_factor" (
  "id" text PRIMARY KEY,
  "secret" text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" text NOT NULL REFERENCES public."stex_auth_user"("id") ON DELETE CASCADE,
  "verified" boolean DEFAULT true,
  "failedVerificationCount" integer DEFAULT 0,
  "lockedUntil" timestamptz
);
CREATE INDEX ON public."stex_auth_two_factor"("secret");
CREATE INDEX ON public."stex_auth_two_factor"("userId");
CREATE UNIQUE INDEX ON public.stex_auth_two_factor("userId");
CREATE UNIQUE INDEX ON public.stex_auth_account("providerId","accountId");
CREATE TABLE stex.account_access (
  user_id text PRIMARY KEY REFERENCES stex.accounts(user_id),
  generation integer NOT NULL DEFAULT 1 CHECK (generation > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO stex.account_access(user_id) SELECT user_id FROM stex.accounts;
CREATE FUNCTION stex.create_account_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO stex.account_access(user_id) VALUES (NEW.user_id); RETURN NEW; END $$;
CREATE TRIGGER account_access_insert AFTER INSERT ON stex.accounts FOR EACH ROW EXECUTE FUNCTION stex.create_account_access();
CREATE TABLE stex.auth_identities (
  user_id text PRIMARY KEY REFERENCES stex.accounts(user_id),
  auth_user_id text NOT NULL UNIQUE REFERENCES public.stex_auth_user(id)
);
CREATE TABLE stex.account_invitations (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES stex.accounts(user_id),
  email text NOT NULL,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text REFERENCES stex.accounts(user_id)
);
CREATE UNIQUE INDEX invitation_open_email ON stex.account_invitations(email) WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE TABLE stex.auth_bootstrap (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id text NOT NULL UNIQUE REFERENCES stex.accounts(user_id),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz
);
CREATE TABLE stex.account_audit (
  id text PRIMARY KEY,
  actor text NOT NULL,
  target text NOT NULL,
  action text NOT NULL,
  request_id text NOT NULL,
  fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor,request_id)
);
-- Library email JWTs also need a server-side revocation boundary after restore.
CREATE TABLE stex.auth_email_tokens (
  token_hash text PRIMARY KEY,
  email text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE stex.auth_mail_outbox (
  id text PRIMARY KEY,
  email text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('invitation','verification','reset')),
  sealed text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stex.auth_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);
