-- ═══════════════════════════════════════════════════════════════════════════
-- MELLO CHAT SYSTEM — Setup for existing `public.chats` table
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Drop and recreate to ensure correct policy
DROP POLICY IF EXISTS "Users manage own chats" ON public.chats;
CREATE POLICY "Users manage own chats" ON public.chats
  FOR ALL USING (auth.uid() = user_id);

-- ─── INDEXES FOR PERFORMANCE ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_updated ON public.chats(user_id, updated_at DESC);

-- ─── AUTO-UPDATE updated_at TRIGGER ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_chats_updated_at ON public.chats;
CREATE TRIGGER trigger_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION update_chats_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT * FROM public.chats LIMIT 5;
