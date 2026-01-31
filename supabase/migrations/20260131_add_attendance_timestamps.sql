-- Migration: Add Timestamps for Attendance Images
-- Description: Adds image_timestamps column to 'attendance' table to track upload times per image

ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS image_timestamps bigint[] DEFAULT '{}';

COMMENT ON COLUMN attendance.image_timestamps IS 'Array of upload timestamps (milliseconds) corresponding to image_urls';
