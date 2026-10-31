-- DATA-B. Original file bytes are deliberately absent from this schema.
CREATE SCHEMA IF NOT EXISTS stex;
CREATE TABLE stex.state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  contract_version integer NOT NULL CHECK (contract_version = 1),
  generation bigint NOT NULL DEFAULT 0 CHECK (generation >= 0)
);
INSERT INTO stex.state VALUES (true, 1, 0);
CREATE TABLE stex.accounts (
  user_id text PRIMARY KEY CHECK (length(btrim(user_id)) > 0),
  status text NOT NULL CHECK (status IN ('pending','active','blocked')),
  role text NOT NULL CHECK (role IN ('member','admin')),
  revision integer NOT NULL CHECK (revision > 0)
);
CREATE TABLE stex.topics (id text PRIMARY KEY CHECK (length(id) > 0));
CREATE TABLE stex.catalog_records (
  record_key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind = 'klausur'),
  id text NOT NULL UNIQUE CHECK (length(id) > 0),
  revision integer NOT NULL CHECK (revision > 0),
  legacy_key text NOT NULL,
  payload jsonb NOT NULL,
  normalized jsonb NOT NULL CHECK (jsonb_typeof(normalized) = 'object'),
  CHECK (record_key::jsonb = jsonb_build_array(kind, NULL, id))
);
CREATE TABLE stex.personal_records (
  record_key text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES stex.accounts(user_id),
  kind text NOT NULL CHECK (kind <> 'klausur'),
  id text NOT NULL CHECK (length(id) > 0),
  revision integer NOT NULL CHECK (revision > 0),
  legacy_key text NOT NULL,
  payload jsonb NOT NULL,
  normalized jsonb NOT NULL CHECK (jsonb_typeof(normalized) = 'object'),
  UNIQUE (owner_user_id, kind, id),
  UNIQUE (record_key, owner_user_id),
  CHECK (record_key::jsonb = jsonb_build_array(kind, owner_user_id, id)),
  CHECK (kind <> 'document' OR (jsonb_typeof(payload) = 'object' AND NOT payload ? 'dataUrl'))
);
CREATE TABLE stex.record_references (
  source_key text NOT NULL,
  path text NOT NULL,
  owner_user_id text REFERENCES stex.accounts(user_id),
  source_personal_key text REFERENCES stex.personal_records(record_key),
  source_catalog_key text REFERENCES stex.catalog_records(record_key),
  target_personal_key text REFERENCES stex.personal_records(record_key),
  target_catalog_key text REFERENCES stex.catalog_records(record_key),
  target_topic_id text REFERENCES stex.topics(id),
  PRIMARY KEY (source_key, path),
  FOREIGN KEY (source_personal_key, owner_user_id) REFERENCES stex.personal_records(record_key, owner_user_id),
  FOREIGN KEY (target_personal_key, owner_user_id) REFERENCES stex.personal_records(record_key, owner_user_id),
  CHECK (num_nonnulls(source_personal_key,source_catalog_key) = 1),
  CHECK (source_key = coalesce(source_personal_key,source_catalog_key)),
  CHECK ((source_personal_key IS NOT NULL AND owner_user_id IS NOT NULL) OR
         (source_catalog_key IS NOT NULL AND owner_user_id IS NULL AND target_topic_id IS NOT NULL)),
  CHECK (num_nonnulls(target_personal_key,target_catalog_key,target_topic_id) = 1)
);
CREATE TABLE stex.document_versions (
  document_version_id text PRIMARY KEY,
  document_id text NOT NULL,
  owner_user_id text NOT NULL REFERENCES stex.accounts(user_id),
  record_key text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  media_type text NOT NULL,
  page_count integer CHECK (page_count > 0),
  text_status text NOT NULL CHECK (text_status IN ('pending','ready','needs_ocr','failed')),
  extraction_version text,
  storage_key text NOT NULL UNIQUE CHECK (storage_key ~ '^objects/[0-9a-f]{64}/[0-9a-f]{64}\.bin$'),
  data_url_header text NOT NULL CHECK (data_url_header ~ '^data:[^;,]*;base64,$'),
  UNIQUE (document_version_id, owner_user_id),
  FOREIGN KEY (record_key, owner_user_id) REFERENCES stex.personal_records(record_key, owner_user_id),
  CHECK (record_key::jsonb = jsonb_build_array('document',owner_user_id,document_id))
);
-- Byte identity, ownership and logical document identity are immutable.
CREATE FUNCTION stex.immutable_document_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.document_version_id,NEW.document_id,NEW.owner_user_id,NEW.record_key,NEW.sha256,NEW.byte_size,NEW.media_type,NEW.storage_key,NEW.data_url_header)
     IS DISTINCT FROM ROW(OLD.document_version_id,OLD.document_id,OLD.owner_user_id,OLD.record_key,OLD.sha256,OLD.byte_size,OLD.media_type,OLD.storage_key,OLD.data_url_header) THEN
    RAISE EXCEPTION 'Document version identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER document_identity BEFORE UPDATE ON stex.document_versions
FOR EACH ROW EXECUTE FUNCTION stex.immutable_document_identity();
CREATE TABLE stex.document_pages (
  document_version_id text NOT NULL REFERENCES stex.document_versions(document_version_id),
  page_number integer NOT NULL CHECK (page_number > 0),
  printed_label text,
  width double precision NOT NULL CHECK (width > 0 AND width < 'Infinity'::float8),
  height double precision NOT NULL CHECK (height > 0 AND height < 'Infinity'::float8),
  rotation integer NOT NULL CHECK (rotation IN (0,90,180,270)),
  text_status text NOT NULL CHECK (text_status IN ('pending','ready','needs_ocr','failed')),
  extraction_version text,
  PRIMARY KEY (document_version_id,page_number)
);
CREATE TABLE stex.annotations (
  id text NOT NULL,
  owner_user_id text NOT NULL REFERENCES stex.accounts(user_id),
  document_version_id text NOT NULL,
  page_number integer NOT NULL,
  rectangles jsonb NOT NULL CHECK (jsonb_typeof(rectangles) = 'array'),
  quote text,
  note text,
  revision integer NOT NULL CHECK (revision > 0),
  PRIMARY KEY (owner_user_id,id),
  FOREIGN KEY (document_version_id,owner_user_id) REFERENCES stex.document_versions(document_version_id,owner_user_id),
  FOREIGN KEY (document_version_id,page_number) REFERENCES stex.document_pages(document_version_id,page_number)
);
CREATE TABLE stex.imports (
  owner_user_id text NOT NULL REFERENCES stex.accounts(user_id),
  request_id text NOT NULL CHECK (length(btrim(request_id)) > 0),
  source_digest text NOT NULL CHECK (source_digest ~ '^[0-9a-f]{64}$'),
  exported_at text NOT NULL,
  areas jsonb NOT NULL CHECK (jsonb_typeof(areas) = 'array'),
  PRIMARY KEY (owner_user_id,request_id)
);
CREATE TABLE stex.import_records (
  owner_user_id text NOT NULL,
  request_id text NOT NULL,
  record_key text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  personal_key text REFERENCES stex.personal_records(record_key),
  catalog_key text REFERENCES stex.catalog_records(record_key),
  PRIMARY KEY (owner_user_id,request_id,record_key),
  FOREIGN KEY (owner_user_id,request_id) REFERENCES stex.imports(owner_user_id,request_id),
  FOREIGN KEY (personal_key,owner_user_id) REFERENCES stex.personal_records(record_key,owner_user_id),
  CHECK (num_nonnulls(personal_key,catalog_key) = 1),
  CHECK (record_key = coalesce(personal_key,catalog_key))
);
CREATE TABLE stex.import_documents (
  owner_user_id text NOT NULL,
  request_id text NOT NULL,
  document_version_id text NOT NULL,
  PRIMARY KEY (owner_user_id,request_id,document_version_id),
  FOREIGN KEY (owner_user_id,request_id) REFERENCES stex.imports(owner_user_id,request_id),
  FOREIGN KEY (document_version_id,owner_user_id) REFERENCES stex.document_versions(document_version_id,owner_user_id)
);
