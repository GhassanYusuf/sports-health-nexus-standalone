-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('membership_approved', 'membership_request', 'package_expiring', 'new_message', 'system_alert', 'announcement', 'class_cancelled')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_club ON public.notifications(club_id, created_at DESC);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins and business owners can create notifications for their club members
CREATE POLICY "Club owners can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  club_id IN (
    SELECT id FROM public.clubs 
    WHERE business_owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'super_admin')
);

-- Super admins can manage all notifications
CREATE POLICY "Super admins can manage all notifications"
ON public.notifications
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  title TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversations_club ON public.conversations(club_id, last_message_at DESC);
CREATE INDEX idx_conversations_user ON public.conversations(user_id, last_message_at DESC);
CREATE UNIQUE INDEX idx_conversations_club_user ON public.conversations(club_id, user_id);

-- Enable RLS on conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations"
ON public.conversations
FOR SELECT
USING (auth.uid() = user_id);

-- Club owners and admins can view conversations for their club
CREATE POLICY "Club owners can view club conversations"
ON public.conversations
FOR SELECT
USING (
  club_id IN (
    SELECT id FROM public.clubs 
    WHERE business_owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'super_admin')
);

-- Users can create conversations with clubs they're members of
CREATE POLICY "Members can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = conversations.club_id
    AND (user_id = auth.uid() OR child_id IN (
      SELECT id FROM public.children WHERE parent_user_id = auth.uid()
    ))
  )
);

-- Club owners can create conversations
CREATE POLICY "Club owners can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (
  club_id IN (
    SELECT id FROM public.clubs 
    WHERE business_owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'super_admin')
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'club_admin', 'system')),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id, created_at DESC);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in their conversations
CREATE POLICY "Users can view own conversation messages"
ON public.messages
FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM public.conversations
    WHERE user_id = auth.uid()
  )
);

-- Club owners can view messages in their club conversations
CREATE POLICY "Club owners can view club messages"
ON public.messages
FOR SELECT
USING (
  conversation_id IN (
    SELECT c.id FROM public.conversations c
    INNER JOIN public.clubs cl ON c.club_id = cl.id
    WHERE cl.business_owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
  )
);

-- Users can send messages in their conversations
CREATE POLICY "Users can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND conversation_id IN (
    SELECT id FROM public.conversations
    WHERE user_id = auth.uid()
  )
);

-- Club owners can send messages in their club conversations
CREATE POLICY "Club owners can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND conversation_id IN (
    SELECT c.id FROM public.conversations c
    INNER JOIN public.clubs cl ON c.club_id = cl.id
    WHERE cl.business_owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
  )
);

-- Users can mark their messages as read
CREATE POLICY "Users can mark messages as read"
ON public.messages
FOR UPDATE
USING (
  conversation_id IN (
    SELECT id FROM public.conversations
    WHERE user_id = auth.uid()
  )
);

-- Club owners can mark messages as read
CREATE POLICY "Club owners can mark messages as read"
ON public.messages
FOR UPDATE
USING (
  conversation_id IN (
    SELECT c.id FROM public.conversations c
    INNER JOIN public.clubs cl ON c.club_id = cl.id
    WHERE cl.business_owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
  )
);

-- Create trigger to update conversation last_message_at
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_conversation_timestamp
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- Add business_owner role to app_role enum if not exists (for future use)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user', 'business_owner', 'super_admin');
  ELSE
    -- Check if business_owner exists, if not add it
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumtypid = 'public.app_role'::regtype 
      AND enumlabel = 'business_owner'
    ) THEN
      ALTER TYPE public.app_role ADD VALUE 'business_owner';
    END IF;
  END IF;
END $$;

-- Enable realtime for notifications and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;