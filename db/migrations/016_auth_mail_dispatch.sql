-- AUTH03: durable, bounded postcommit mail dispatch. No external transport here.
ALTER TABLE stex.auth_mail_outbox
  ADD COLUMN dispatch_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN dispatch_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN claim_token text,
  ADD COLUMN lease_until timestamptz,
  ADD COLUMN last_error_code text,
  ADD COLUMN sent_at timestamptz,
  ADD CONSTRAINT auth_mail_dispatch_status CHECK (dispatch_status IN
    ('pending','claimed','sending','sent','failed','cancelled','expired','uncertain')),
  ADD CONSTRAINT auth_mail_dispatch_attempts CHECK (dispatch_attempts BETWEEN 0 AND 5),
  ADD CONSTRAINT auth_mail_dispatch_claim CHECK (
    (dispatch_status IN ('claimed','sending') AND claim_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (dispatch_status NOT IN ('claimed','sending') AND claim_token IS NULL AND lease_until IS NULL)),
  ADD CONSTRAINT auth_mail_dispatch_sent CHECK ((dispatch_status='sent') = (sent_at IS NOT NULL)),
  ADD CONSTRAINT auth_mail_dispatch_error CHECK (last_error_code IS NULL OR last_error_code IN
    ('outbox_expired','proof_invalid','proof_expired','proof_not_ready','invalid_message',
     'attempts_exhausted','claim_expired','sending_expired','transport_rejected',
     'transport_temporary','transport_unknown','transport_timeout'));

CREATE INDEX auth_mail_dispatch_pending ON stex.auth_mail_outbox(next_attempt_at,created_at,id)
  WHERE dispatch_status='pending';
CREATE INDEX auth_mail_dispatch_leases ON stex.auth_mail_outbox(lease_until)
  WHERE dispatch_status IN ('claimed','sending');
