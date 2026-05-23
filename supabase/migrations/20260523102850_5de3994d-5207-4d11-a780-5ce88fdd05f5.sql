
-- Extend snag_status enum
ALTER TYPE snag_status ADD VALUE IF NOT EXISTS 'fixed';
ALTER TYPE snag_status ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE snag_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE snag_status ADD VALUE IF NOT EXISTS 'reopened';
