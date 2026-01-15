-- =============================================
-- 030_employees_dashboard.sql (FIXED)
-- Aligns with users + workspace_members roles
-- =============================================

-- ============================================================================
-- 1. EMPLOYEES TABLE (NO ROLE DUPLICATION)
-- ============================================================================

DROP TABLE IF EXISTS public.employees CASCADE;

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE, -- NULL = Retail Assist
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, business_id)
);

-- ============================================================================
-- 2. MESSAGES TABLE
-- ============================================================================

DROP TABLE IF EXISTS public.messages CASCADE;

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('facebook', 'instagram', 'whatsapp', 'website_chat')),
  content TEXT NOT NULL,
  ai_response TEXT,
  ai_confidence NUMERIC(3,2),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'escalated', 'completed')),
  assigned_to_employee_id UUID REFERENCES public.employees(id),
  escalated_to_admin_id UUID REFERENCES public.users(id),
  business_id UUID REFERENCES public.workspaces(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. MESSAGE QUEUES
-- ============================================================================

DROP TABLE IF EXISTS public.message_queues CASCADE;

CREATE TABLE public.message_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'completed')),
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (message_id, employee_id)
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX idx_employees_user ON public.employees(user_id);
CREATE INDEX idx_employees_business ON public.employees(business_id);

CREATE INDEX idx_messages_business ON public.messages(business_id);
CREATE INDEX idx_messages_status ON public.messages(status);
CREATE INDEX idx_messages_assigned ON public.messages(assigned_to_employee_id);

CREATE INDEX idx_queue_employee ON public.message_queues(employee_id);
CREATE INDEX idx_queue_message ON public.message_queues(message_id);

-- ============================================================================
-- 5. RLS ENABLE
-- ============================================================================

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_queues ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- -------- EMPLOYEES --------

-- Super Admin: all employees
CREATE POLICY employees_super_admin
ON public.employees FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = employees.user_id
    AND u.auth_uid = auth.uid()
    AND u.role = 'super_admin'
  )
);

-- Self access
CREATE POLICY employees_self
ON public.employees FOR SELECT
USING (
  user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
);

-- Business admins see employees in their workspace
CREATE POLICY employees_business_admin
ON public.employees FOR SELECT
USING (
  business_id IN (
    SELECT wm.workspace_id
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE u.auth_uid = auth.uid()
      AND wm.role IN ('owner','admin')
  )
);

-- -------- MESSAGES --------

-- Super Admin: everything
CREATE POLICY messages_super_admin
ON public.messages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid()
    AND u.role = 'super_admin'
  )
);

-- Business admins: their workspace messages
CREATE POLICY messages_business_admin
ON public.messages FOR ALL
USING (
  business_id IN (
    SELECT wm.workspace_id
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE u.auth_uid = auth.uid()
      AND wm.role IN ('owner','admin')
  )
);

-- Employees: assigned messages only
CREATE POLICY messages_employee
ON public.messages FOR SELECT
USING (
  assigned_to_employee_id IN (
    SELECT e.id
    FROM public.employees e
    JOIN public.users u ON u.id = e.user_id
    WHERE u.auth_uid = auth.uid()
  )
);

-- -------- MESSAGE QUEUES --------

CREATE POLICY queues_employee
ON public.message_queues FOR ALL
USING (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    JOIN public.users u ON u.id = e.user_id
    WHERE u.auth_uid = auth.uid()
  )
);

-- ============================================================================
-- 7. TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_updated
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_messages_updated
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_queues_updated
BEFORE UPDATE ON public.message_queues
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 8. AUTO QUEUE
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_queue_message()
RETURNS TRIGGER AS $$
DECLARE
  emp RECORD;
BEGIN
  IF NEW.status = 'new' AND (NEW.ai_confidence IS NULL OR NEW.ai_confidence < 0.8) THEN
    FOR emp IN
      SELECT id FROM public.employees
      WHERE business_id IS NOT DISTINCT FROM NEW.business_id
        AND is_active = TRUE
    LOOP
      INSERT INTO public.message_queues (message_id, employee_id)
      VALUES (NEW.id, emp.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_queue
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION auto_queue_message();

-- =============================================
-- END FIXED 030
-- =============================================