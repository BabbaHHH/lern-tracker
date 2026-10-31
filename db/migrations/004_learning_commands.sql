-- Private, committed learning actions. No changes to existing account/catalog identities.
CREATE TABLE stex.learning_commands (
  owner_user_id text NOT NULL REFERENCES stex.accounts(user_id),
  request_id text NOT NULL CHECK (request_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  contract_version integer NOT NULL CHECK (contract_version = 1),
  action text NOT NULL CHECK (action IN ('set','undo')),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  before_values jsonb NOT NULL CHECK (jsonb_typeof(before_values) = 'array'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id,request_id)
);
