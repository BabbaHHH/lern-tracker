-- Derived search data: deliberately rebuilt, not included in backup format 3.
CREATE TABLE stex.search_jobs (
  document_version_id text PRIMARY KEY REFERENCES stex.catalog_document_versions(document_version_id) ON DELETE CASCADE,
  epoch uuid NOT NULL DEFAULT gen_random_uuid(),
  state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','complete','failed','superseded')),
  token uuid,
  manifest jsonb,
  attempts integer NOT NULL DEFAULT 0,
  error_code text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stex.search_pages (
  document_version_id text NOT NULL REFERENCES stex.search_jobs(document_version_id) ON DELETE CASCADE,
  epoch uuid NOT NULL,
  page_number integer NOT NULL CHECK(page_number>0),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  PRIMARY KEY(document_version_id,epoch,page_number)
);
CREATE FUNCTION stex.enqueue_catalog_search() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO stex.search_jobs(document_version_id) VALUES(NEW.document_version_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER enqueue_catalog_search AFTER INSERT ON stex.catalog_document_versions
FOR EACH ROW EXECUTE FUNCTION stex.enqueue_catalog_search();
INSERT INTO stex.search_jobs(document_version_id)
SELECT DISTINCT ON(document_id) document_version_id FROM stex.catalog_document_versions ORDER BY document_id,version_number DESC;
