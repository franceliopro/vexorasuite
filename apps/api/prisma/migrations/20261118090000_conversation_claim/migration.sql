ALTER TABLE "conversations" ADD COLUMN "claimed_by_id" UUID;

CREATE FUNCTION revoke_conversation_claim() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.handling_mode <> 'HUMAN'
     OR NEW.claimed_by_id IS DISTINCT FROM NEW.assignee_id
     OR NEW.status NOT IN ('OPEN', 'PENDING')
     OR NEW.archived_at IS NOT NULL
     OR NEW.deleted_at IS NOT NULL
     OR (NEW.department_id IS DISTINCT FROM OLD.department_id
         AND NEW.claimed_by_id IS NOT DISTINCT FROM OLD.claimed_by_id) THEN
    NEW.claimed_by_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_revoke_claim
BEFORE UPDATE OF handling_mode, assignee_id, department_id, status, archived_at, deleted_at, claimed_by_id
ON "conversations" FOR EACH ROW EXECUTE FUNCTION revoke_conversation_claim();
