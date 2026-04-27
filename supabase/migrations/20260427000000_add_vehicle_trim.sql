-- Add vehicle_trim column to submissions.
-- Editable from the customer file slide-out; nullable free-text since not every
-- lead arrives with a trim level captured.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS vehicle_trim TEXT;
