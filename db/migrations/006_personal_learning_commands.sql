-- Extend the existing private receipt contract without replacing C1 receipts or columns.
ALTER TABLE stex.learning_commands DROP CONSTRAINT learning_commands_action_check;
ALTER TABLE stex.learning_commands ADD CONSTRAINT learning_commands_action_check
  CHECK (action IN ('set','undo','profile','note'));
