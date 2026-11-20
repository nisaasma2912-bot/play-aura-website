# Play Aura — Supabase & Free Deployment Setup Guide

Play Aura includes a ready-to-connect Supabase integration for private admin authentication, Draft/Published/Unpublished game management, and safe HTML5 ZIP uploads.

---

## 1. Create Your Free Supabase Project

1. Sign up or log in at [supabase.com](https://supabase.com) and create a new project.
2. Open **Project Settings → API** and copy:
   - **Project URL** (`VITE_SUPABASE_URL`)
   - **anon public key** (`VITE_SUPABASE_ANON_KEY`)
3. **Security Rule**: Never place your `service_role` key inside `VITE_*` environment variables or frontend code.

Create a `.env` file in your project root:

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-public-anon-key"

# Optional Google AdSense settings
VITE_ADSENSE_CLIENT_ID=""
VITE_ADSENSE_HOME_SLOT=""
VITE_ADSENSE_PLAYER_SLOT=""
```

---

## 2. Create Database Tables, RLS Policies, and Storage Buckets

Open **SQL Editor** in your Supabase project and run the SQL below:

```sql
-- 1. Games table
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  thumbnail_url text not null default '',
  game_entry_url text not null,
  storage_path text,
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Admin users table
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 3. Enable RLS
alter table public.games enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_playaura_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

-- Games policies
create policy "Public can view published games"
on public.games for select
using ((status = 'published' and is_published = true) or public.is_playaura_admin());

create policy "Admins can insert games"
on public.games for insert
to authenticated
with check (public.is_playaura_admin());

create policy "Admins can update games"
on public.games for update
to authenticated
using (public.is_playaura_admin())
with check (public.is_playaura_admin());

create policy "Admins can delete games"
on public.games for delete
to authenticated
using (public.is_playaura_admin());

create policy "Users can check own admin status"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

-- 4. Storage buckets ('games' and 'thumbnails.')
insert into storage.buckets (id, name, public)
values ('games', 'games', true), ('thumbnails.', 'thumbnails.', true)
on conflict (id) do nothing;

create policy "Public read game files"
on storage.objects for select
using (bucket_id in ('games', 'thumbnails.'));

create policy "Admins upload game files"
on storage.objects for insert
to authenticated
with check (bucket_id in ('games', 'thumbnails.') and public.is_playaura_admin());

create policy "Admins update game files"
on storage.objects for update
to authenticated
using (bucket_id in ('games', 'thumbnails.') and public.is_playaura_admin())
with check (bucket_id in ('games', 'thumbnails.') and public.is_playaura_admin());

create policy "Admins delete game files"
on storage.objects for delete
to authenticated
using (bucket_id in ('games', 'thumbnails.') and public.is_playaura_admin());
```

### 2B. Create Game Suggestions & Visitor Moderation Tables

Run the SQL file at `supabase/migrations/20261119_game_suggestions.sql` in your Supabase **SQL Editor** to create:
- `public.game_suggestions`
- `public.blocked_suggestion_visitors`
- Admin-only Row Level Security policies using `public.is_playaura_admin()`
- The validated `public.submit_game_suggestion(p_message text, p_visitor_token_hash text)` RPC function

---

## 3. Add Your First Admin User

1. In Supabase, open **Authentication → Users → Add user** and create an account with email and password.
2. Copy the new user's **User UID**.
3. Run this query in the **SQL Editor**:

```sql
insert into public.admin_users (user_id)
values ('PASTE-YOUR-USER-UUID-HERE');
```

Now open **Admin Login** in Play Aura and sign in with that email and password.

---

## 4. Free Deployment Options

Play Aura builds into a fast static site (`dist/`), so you can host it for free on:

### Option A: Vercel (Free Hobby Tier)
1. Push your code to GitHub (`.env` is ignored by `.gitignore`).
2. Import the repository at [vercel.com](https://vercel.com).
3. Framework Preset: **Vite** (`npm run build`, output `dist`).
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and optional `VITE_ADSENSE_*`) under **Settings → Environment Variables**.
5. Click **Deploy**.

### Option B: Netlify or Cloudflare Pages (Free Tier)
1. Connect your GitHub repository.
2. Set Build Command: `npm run build` and Publish Directory: `dist`.
3. Add your `VITE_*` environment variables in the dashboard and deploy.
