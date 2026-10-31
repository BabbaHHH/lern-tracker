-- Plan receipts reuse existing private columns and format-4 full backup.
ALTER TABLE stex.learning_commands DROP CONSTRAINT learning_commands_action_check;
ALTER TABLE stex.learning_commands ADD CONSTRAINT learning_commands_action_check
 CHECK (action IN ('set','undo','profile','note','schedule','plan'));
