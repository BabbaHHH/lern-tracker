-- Check-in proposals and atomic confirmations use complete private format-4 receipts.
ALTER TABLE stex.learning_commands DROP CONSTRAINT learning_commands_action_check;
ALTER TABLE stex.learning_commands ADD CONSTRAINT learning_commands_action_check
 CHECK (action IN ('set','undo','profile','note','schedule','plan','preparation','checkin'));
