-- Existing private settings payloads and receipts remain covered by backup format 4.
ALTER TABLE stex.learning_commands DROP CONSTRAINT learning_commands_action_check;
ALTER TABLE stex.learning_commands ADD CONSTRAINT learning_commands_action_check
 CHECK (action IN ('set','undo','profile','note','schedule','plan','preparation','checkin','writing','correction','documents','settings'));
