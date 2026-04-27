-- Atomic increment for snippet use counter — prevents race conditions when
-- multiple users insert the same snippet into proposals simultaneously.

CREATE OR REPLACE FUNCTION public.increment_snippet_use_count(snippet_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.content_snippets
  SET use_count = use_count + 1,
      updated_at = now()
  WHERE id = snippet_id;
$$;
