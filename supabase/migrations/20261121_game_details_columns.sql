-- Play Aura Additive Game Information Columns Migration
-- Safe, non-destructive migration: adds optional instruction and control columns to public.games
-- without altering or deleting any existing game records, IDs, slugs, URLs, or policies.

alter table public.games
  add column if not exists how_to_play text not null default '',
  add column if not exists objective text not null default '',
  add column if not exists keyboard_controls text not null default '',
  add column if not exists mouse_controls text not null default '',
  add column if not exists touch_controls text not null default '',
  add column if not exists tips text not null default '';

-- Refresh PostgREST schema cache so the API recognizes the new optional columns immediately
notify pgrst, 'reload schema';
