-- Existing private receipt columns and format-4 backup remain intact.
ALTER TABLE stex.learning_commands DROP CONSTRAINT learning_commands_action_check;
ALTER TABLE stex.learning_commands ADD CONSTRAINT learning_commands_action_check
  CHECK (action IN ('set','undo','profile','note','schedule'));
