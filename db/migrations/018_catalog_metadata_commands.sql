-- B2: owner-scoped durable admin mutation receipts. No FK to a catalog row:
-- receipts are immutable historical outcomes, including successful deletion.
CREATE TABLE stex.catalog_metadata_commands (
  owner_user_id text NOT NULL REFERENCES stex.accounts(user_id),
  request_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('import','patch','delete')),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (owner_user_id, request_id)
);
