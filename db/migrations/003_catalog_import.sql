-- IMPORT-B: shared catalog documents, immutable versions and durable import receipts.
-- Personal DATA-B document_versions remain owner-scoped and are deliberately untouched.
CREATE TABLE stex.catalog_imports (
  import_id text PRIMARY KEY CHECK (length(btrim(import_id)) > 0),
  submitted_by_user_id text NOT NULL REFERENCES stex.accounts(user_id),
  request_id text NOT NULL UNIQUE CHECK (length(btrim(request_id)) > 0),
  source_digest text NOT NULL CHECK (source_digest ~ '^[0-9a-f]{64}$'),
  source_reference text NOT NULL CHECK (length(btrim(source_reference)) > 0 AND length(source_reference) <= 255),
  status text NOT NULL CHECK (status IN ('queued','processing','committed','failed')),
  acceptance_mode text NOT NULL CHECK (acceptance_mode = 'direct'),
  content_check text NOT NULL CHECK (content_check = 'not-performed'),
  technical_validation text NOT NULL CHECK (technical_validation IN ('pending','valid','invalid')),
  duplicate_status text NOT NULL CHECK (duplicate_status IN ('pending','identical','candidate','distinct','conflict')),
  klausur_id text REFERENCES stex.catalog_records(id),
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  warnings jsonb NOT NULL CHECK (jsonb_typeof(warnings) = 'array'),
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX catalog_imports_submitted_idx ON stex.catalog_imports(submitted_by_user_id,created_at DESC);

CREATE TABLE stex.catalog_documents (
  document_id text PRIMARY KEY CHECK (length(btrim(document_id)) > 0),
  record_key text NOT NULL REFERENCES stex.catalog_records(record_key),
  klausur_id text NOT NULL REFERENCES stex.catalog_records(id),
  role text NOT NULL CHECK (role IN ('sachverhalt','loesung','kombiniert','unbekannt')),
  source_reference text NOT NULL CHECK (length(btrim(source_reference)) > 0 AND length(source_reference) <= 255),
  created_by_user_id text NOT NULL REFERENCES stex.accounts(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(record_key,role),
  CHECK (record_key::jsonb = jsonb_build_array('klausur',NULL,klausur_id))
);
CREATE INDEX catalog_documents_klausur_idx ON stex.catalog_documents(klausur_id,role);

CREATE TABLE stex.catalog_document_versions (
  document_version_id text PRIMARY KEY CHECK (length(btrim(document_version_id)) > 0),
  document_id text NOT NULL REFERENCES stex.catalog_documents(document_id),
  version_number integer NOT NULL CHECK (version_number > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  media_type text NOT NULL CHECK (media_type = 'application/pdf'),
  page_count integer CHECK (page_count > 0),
  text_status text NOT NULL CHECK (text_status IN ('pending','ready','needs_ocr','failed')),
  extraction_version text,
  storage_key text NOT NULL UNIQUE CHECK (storage_key ~ '^objects/[0-9a-f]{64}/[0-9a-f]{64}\.bin$'),
  data_url_header text NOT NULL CHECK (data_url_header = 'data:application/pdf;base64,'),
  source_filename text NOT NULL CHECK (length(btrim(source_filename)) > 0 AND length(source_filename) <= 255),
  submitted_by_user_id text NOT NULL REFERENCES stex.accounts(user_id),
  import_id text NOT NULL REFERENCES stex.catalog_imports(import_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id,version_number),
  UNIQUE(document_id,sha256)
);
CREATE INDEX catalog_document_versions_hash_idx ON stex.catalog_document_versions(sha256);
CREATE INDEX catalog_document_versions_import_idx ON stex.catalog_document_versions(import_id);

CREATE FUNCTION stex.immutable_catalog_document_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.document_version_id,NEW.document_id,NEW.version_number,NEW.sha256,NEW.byte_size,NEW.media_type,NEW.storage_key,NEW.data_url_header,NEW.source_filename,NEW.submitted_by_user_id,NEW.import_id)
     IS DISTINCT FROM ROW(OLD.document_version_id,OLD.document_id,OLD.version_number,OLD.sha256,OLD.byte_size,OLD.media_type,OLD.storage_key,OLD.data_url_header,OLD.source_filename,OLD.submitted_by_user_id,OLD.import_id) THEN
    RAISE EXCEPTION 'Catalog document version identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER catalog_document_identity BEFORE UPDATE ON stex.catalog_document_versions
FOR EACH ROW EXECUTE FUNCTION stex.immutable_catalog_document_identity();

CREATE TABLE stex.catalog_import_documents (
  import_id text NOT NULL REFERENCES stex.catalog_imports(import_id),
  document_version_id text NOT NULL REFERENCES stex.catalog_document_versions(document_version_id),
  role text NOT NULL CHECK (role IN ('sachverhalt','loesung','kombiniert','unbekannt')),
  PRIMARY KEY(import_id,document_version_id)
);
