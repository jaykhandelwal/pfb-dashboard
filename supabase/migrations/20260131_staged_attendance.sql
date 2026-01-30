-- Migration: Enable Staged Attendance Feature
-- Description: Adds configuration columns to 'users' and multi-image support to 'attendance'

-- 1. Add Staged Attendance Configuration to Users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_staged_attendance_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS staged_attendance_config jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN users.is_staged_attendance_enabled IS 'If true, user must follow staged attendance flow';
COMMENT ON COLUMN users.staged_attendance_config IS 'Array of stages: [{id, title, cameraFacingMode: "user"|"environment"}]';

-- 2. Add Multi-Image Support to Attendance table
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

COMMENT ON COLUMN attendance.image_urls IS 'Array of image URLs for staged attendance';
