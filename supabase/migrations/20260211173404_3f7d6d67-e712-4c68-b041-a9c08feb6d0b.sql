
CREATE TABLE public.pending_admin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.pending_admin_requests ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert their own request
CREATE POLICY "Users can create own request"
ON public.pending_admin_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can read their own request status
CREATE POLICY "Users can read own request"
ON public.pending_admin_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can read all requests
CREATE POLICY "Admins can read all requests"
ON public.pending_admin_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update requests"
ON public.pending_admin_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));
