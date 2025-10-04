-- Drop existing constraint and update enum values
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Create new project status enum
CREATE TYPE public.project_status AS ENUM (
  'draft', 
  'pre_approval', 
  'partner_assigned', 
  'pm_assigned', 
  'team_assembled', 
  'in_progress', 
  'qa_review', 
  'client_signoff', 
  'closed', 
  'archived'
);

-- Update projects table to use new enum
ALTER TABLE public.projects ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.projects ALTER COLUMN status TYPE project_status USING status::project_status;
ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'draft'::project_status;