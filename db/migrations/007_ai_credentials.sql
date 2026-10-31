CREATE TABLE stex.ai_credentials (
  credential_id text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES stex.accounts(user_id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('pilot','own')),
  encrypted_key text,
  key_fingerprint text UNIQUE CHECK (key_fingerprint IS NULL OR key_fingerprint ~ '^[0-9a-f]{64}$'),
  key_suffix text CHECK (key_suffix IS NULL OR length(key_suffix) = 4),
  configured boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text REFERENCES stex.accounts(user_id) ON DELETE SET NULL,
  updated_by_user_id text REFERENCES stex.accounts(user_id) ON DELETE SET NULL,
  UNIQUE (owner_user_id, source),
  CHECK (
    (configured AND encrypted_key IS NOT NULL AND key_fingerprint IS NOT NULL AND key_suffix IS NOT NULL AND revision > 0)
    OR
    (NOT configured AND encrypted_key IS NULL AND key_fingerprint IS NULL AND key_suffix IS NULL)
  )
);

CREATE TABLE stex.ai_credential_selections (
  owner_user_id text PRIMARY KEY REFERENCES stex.accounts(user_id) ON DELETE CASCADE,
  selected_source text NOT NULL CHECK (selected_source IN ('off','pilot','own')),
  revision integer NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id text REFERENCES stex.accounts(user_id) ON DELETE SET NULL
);

CREATE INDEX ai_credentials_owner_source ON stex.ai_credentials(owner_user_id, source);
