ALTER TABLE "knowledgebase" ADD CONSTRAINT "kb_knowledgebase_index_status_check" CHECK ("index_status" in ('ready', 'stale', 'indexing'));
ALTER TABLE "kb_document" ADD CONSTRAINT "kb_document_status_check" CHECK ("status" in ('pending', 'processing', 'ready', 'failed'));
