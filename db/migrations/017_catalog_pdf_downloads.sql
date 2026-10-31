-- Explicit catalog download commands only; ordinary viewer reads never write here.
-- Keep receipts across sessions/restarts/restores. The unique bounded slot is a
-- database backstop in addition to the shared state writer lock.
CREATE TABLE stex.catalog_pdf_downloads (
  owner_user_id text NOT NULL REFERENCES stex.accounts(user_id),
  request_id uuid NOT NULL,
  download_day date NOT NULL,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 5),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (owner_user_id, request_id),
  UNIQUE (owner_user_id, download_day, slot)
);
