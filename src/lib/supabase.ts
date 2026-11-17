import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminUserSession,
  ExtractedGameFile,
  GameRecord,
  GameStatus,
} from '../types/game';
import { slugifyGameTitle } from './zipValidator';

export const GAMES_BUCKET = 'games' as const;
export const THUMBNAILS_BUCKET = 'thumbnails.' as const;

function sanitizeEnvValue(raw: string | undefined): string {
  if (!raw) return '';
  let val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

const rawSupabaseUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
    : undefined;
const rawSupabaseAnonKey =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
    : undefined;

const supabaseUrl = sanitizeEnvValue(rawSupabaseUrl).replace(/\/+$/, '');
const supabaseAnonKey = sanitizeEnvValue(rawSupabaseAnonKey);

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  /^https?:\/\//i.test(supabaseUrl) &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-supabase-anon');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

interface DbGameRow {
  id: string;
  title: string;
  slug?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  game_entry_url?: string | null;
  game_url?: string | null;
  storage_path: string | null;
  status?: string | null;
  is_published?: boolean | null;
  created_at: string;
  updated_at?: string | null;
}

function normalizeStatus(row: DbGameRow): GameStatus {
  if (row.status === 'draft' || row.status === 'published' || row.status === 'unpublished') {
    return row.status;
  }
  return row.is_published ? 'published' : 'unpublished';
}

export function resolveThumbnailUrl(rawUrl?: string | null): string {
  const trimmed = rawUrl?.trim() || '';
  if (!trimmed) return '';
  if (/^(?:https?:|data:|blob:)/i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }
  const cleanKey = trimmed
    .replace(/^\/+/, '')
    .replace(/^thumbnails\.?\//i, '');
  if (!cleanKey || !supabase) {
    return trimmed;
  }
  const { data } = supabase.storage.from(THUMBNAILS_BUCKET).getPublicUrl(cleanKey);
  return data.publicUrl || trimmed;
}

function mapDbRow(row: DbGameRow): GameRecord {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug || row.id,
    description: row.description ?? '',
    thumbnailUrl: resolveThumbnailUrl(row.thumbnail_url),
    gameEntryUrl: row.game_entry_url || row.game_url || '',
    storagePath: row.storage_path,
    status: normalizeStatus(row),
    createdAt: row.created_at,
  };
}

export class UnauthorizedAdminError extends Error {
  constructor(message = 'This account is not authorized as a Play Aura administrator.') {
    super(message);
    this.name = 'UnauthorizedAdminError';
  }
}

export type AdminAuthState =
  | { status: 'unauthenticated' }
  | { status: 'authorized'; session: AdminUserSession }
  | { status: 'unauthorized' };

async function verifyIsAuthorizedAdmin(
  client: SupabaseClient,
  userId: string,
  appMetadata?: Record<string, unknown>
): Promise<boolean> {
  if (appMetadata?.role === 'admin') {
    return true;
  }
  const { data, error } = await client
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error) {
    return Boolean(data);
  }

  const { data: rpcAllowed, error: rpcError } = await client.rpc('is_playaura_admin');
  if (rpcError) {
    return false;
  }
  return Boolean(rpcAllowed);
}

export async function getCurrentAdminAuthState(): Promise<AdminAuthState> {
  if (!supabase) return { status: 'unauthenticated' };
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return { status: 'unauthenticated' };

  const isAdmin = await verifyIsAuthorizedAdmin(supabase, user.id, user.app_metadata);
  if (!isAdmin) {
    await supabase.auth.signOut();
    return { status: 'unauthorized' };
  }

  return {
    status: 'authorized',
    session: {
      userId: user.id,
      email: user.email || 'Admin',
    },
  };
}

export async function getCurrentAdminSession(): Promise<AdminUserSession | null> {
  const authState = await getCurrentAdminAuthState();
  return authState.status === 'authorized' ? authState.session : null;
}

export async function signInAdmin(email: string, password: string): Promise<AdminUserSession> {
  if (!supabase) {
    throw new Error(
      'Supabase is not connected yet. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.'
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    throw new Error(error?.message || 'Unable to sign in. Please check your email and password.');
  }

  const isAdmin = await verifyIsAuthorizedAdmin(supabase, data.user.id, data.user.app_metadata);
  if (!isAdmin) {
    await supabase.auth.signOut();
    throw new UnauthorizedAdminError('This account is not authorized as a Play Aura administrator.');
  }

  return {
    userId: data.user.id,
    email: data.user.email || email,
  };
}

export async function signOutAdmin(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function fetchPublishedSupabaseGames(): Promise<GameRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Unable to load published games.');
  }
  return ((data || []) as DbGameRow[])
    .map(mapDbRow)
    .filter((game) => game.status === 'published');
}

export async function fetchAllGamesForAdmin(): Promise<GameRecord[]> {
  if (!supabase) {
    throw new Error('Supabase is not connected.');
  }
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return ((data || []) as DbGameRow[]).map(mapDbRow);
}

export interface CreateGameInput {
  title: string;
  description: string;
  status: GameStatus;
  entryPath: string;
  extractedFiles: ExtractedGameFile[];
  thumbnailFile?: File | null;
  thumbnailUrlFallback?: string;
  onProgress?: (label: string, percent: number) => void;
}

function getThumbnailContentType(file: File): { ext: string; contentType: string } {
  const rawExt = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  const ext = rawExt || 'jpg';
  if (file.type) {
    return { ext, contentType: file.type };
  }
  const mimeByExt: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
  };
  return { ext, contentType: mimeByExt[ext] || 'image/jpeg' };
}

function formatStorageErrorMessage(
  prefix: string,
  bucket: string,
  err: { message?: string; statusCode?: string | number; error?: string }
): string {
  const rawMessage = err.message?.trim() || err.error?.trim() || 'Unknown storage error';
  const details: string[] = [];
  if (err.statusCode) {
    details.push(`status ${err.statusCode}`);
  }
  details.push(`bucket "${bucket}"`);
  return `${prefix}: ${rawMessage} (${details.join(', ')})`;
}

export async function uploadAndCreateGame(input: CreateGameInput): Promise<GameRecord> {
  if (!supabase) {
    throw new Error('Supabase is not connected. Configure your Supabase project first.');
  }

  const slug = `${slugifyGameTitle(input.title)}-${Date.now().toString(36)}`;
  const storageFolder = slug;

  // 1. Upload thumbnail to exact "thumbnails." bucket if provided
  let finalThumbnailUrl = input.thumbnailUrlFallback?.trim() || '';
  if (input.thumbnailFile) {
    input.onProgress?.('Uploading thumbnail image...', 10);
    const { ext, contentType } = getThumbnailContentType(input.thumbnailFile);
    const thumbPath = `${storageFolder}.${ext}`;
    const thumbBlob = new Blob([input.thumbnailFile], { type: contentType });
    const { error: thumbErr } = await supabase.storage
      .from(THUMBNAILS_BUCKET)
      .upload(thumbPath, thumbBlob, {
        contentType,
        upsert: false,
      });

    if (thumbErr) {
      throw new Error(
        formatStorageErrorMessage(
          'Thumbnail upload failed',
          THUMBNAILS_BUCKET,
          thumbErr as { message?: string; statusCode?: string | number; error?: string }
        )
      );
    }

    const { data: pubThumb } = supabase.storage.from(THUMBNAILS_BUCKET).getPublicUrl(thumbPath);
    if (!pubThumb?.publicUrl) {
      throw new Error('Thumbnail uploaded, but Supabase did not return a public thumbnail URL.');
    }
    finalThumbnailUrl = pubThumb.publicUrl;
  }

  // 2. Upload every extracted HTML5 game file to exact "games" bucket preserving paths & folders
  const totalFiles = input.extractedFiles.length;
  const BATCH_SIZE = 4;
  let uploadedCount = 0;

  for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
    const batch = input.extractedFiles.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (file) => {
        const targetPath = `${storageFolder}/${file.relativePath}`;
        const blob = new Blob([new Uint8Array(file.data)], { type: file.contentType });
        const { error: uploadErr } = await supabase!.storage
          .from(GAMES_BUCKET)
          .upload(targetPath, blob, {
            contentType: file.contentType,
            upsert: false,
          });

        if (uploadErr) {
          throw new Error(
            formatStorageErrorMessage(
              `Failed uploading "${file.relativePath}"`,
              GAMES_BUCKET,
              uploadErr as { message?: string; statusCode?: string | number; error?: string }
            )
          );
        }

        uploadedCount += 1;
        const percent = 15 + Math.round((uploadedCount / totalFiles) * 75);
        input.onProgress?.(`Uploading game files (${uploadedCount}/${totalFiles})...`, percent);
      })
    );
  }

  // 3. Resolve stable public entry URL and save database record
  input.onProgress?.('Saving game to library...', 94);
  const { data: entryData } = supabase.storage
    .from(GAMES_BUCKET)
    .getPublicUrl(`${storageFolder}/${input.entryPath}`);

  const { data: inserted, error: dbErr } = await supabase
    .from('games')
    .insert({
      title: input.title.trim(),
      slug,
      description: input.description.trim(),
      thumbnail_url: finalThumbnailUrl,
      game_entry_url: entryData.publicUrl,
      storage_path: storageFolder,
      status: input.status,
      is_published: input.status === 'published',
    })
    .select()
    .single();

  if (dbErr || !inserted) {
    throw new Error(`Could not save game record: ${dbErr?.message || 'Unknown error'}`);
  }

  input.onProgress?.('Upload complete!', 100);
  return mapDbRow(inserted as DbGameRow);
}

export async function updateGameAdmin(
  game: GameRecord,
  updates: {
    title: string;
    description: string;
    thumbnailUrl: string;
    thumbnailFile?: File | null;
    status: GameStatus;
  }
): Promise<GameRecord> {
  if (!supabase) throw new Error('Supabase is not connected.');

  let nextThumbUrl = updates.thumbnailUrl.trim() || game.thumbnailUrl || '';
  if (updates.thumbnailFile) {
    const { ext, contentType } = getThumbnailContentType(updates.thumbnailFile);
    const thumbPath = `${game.storagePath || game.slug}-${Date.now().toString(36)}.${ext}`;
    const thumbBlob = new Blob([updates.thumbnailFile], { type: contentType });
    const { error: thumbErr } = await supabase.storage
      .from(THUMBNAILS_BUCKET)
      .upload(thumbPath, thumbBlob, {
        contentType,
        upsert: false,
      });
    if (thumbErr) {
      throw new Error(
        formatStorageErrorMessage(
          'Thumbnail update failed',
          THUMBNAILS_BUCKET,
          thumbErr as { message?: string; statusCode?: string | number; error?: string }
        )
      );
    }
    const { data: pubThumb } = supabase.storage.from(THUMBNAILS_BUCKET).getPublicUrl(thumbPath);
    if (!pubThumb?.publicUrl) {
      throw new Error('Thumbnail uploaded, but Supabase did not return a public thumbnail URL.');
    }
    nextThumbUrl = pubThumb.publicUrl;
  }

  const { data, error } = await supabase
    .from('games')
    .update({
      title: updates.title.trim(),
      description: updates.description.trim(),
      thumbnail_url: nextThumbUrl,
      status: updates.status,
      is_published: updates.status === 'published',
      updated_at: new Date().toISOString(),
    })
    .eq('id', game.id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Could not update game.');
  }
  return mapDbRow(data as DbGameRow);
}

export async function updateGameStatusAdmin(id: string, status: GameStatus): Promise<GameRecord> {
  if (!supabase) throw new Error('Supabase is not connected.');
  const { data, error } = await supabase
    .from('games')
    .update({
      status,
      is_published: status === 'published',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Could not update game status.');
  }
  return mapDbRow(data as DbGameRow);
}

async function listFolderRecursive(client: SupabaseClient, prefix: string): Promise<string[]> {
  const { data } = await client.storage.from(GAMES_BUCKET).list(prefix, { limit: 1000 });
  if (!data || data.length === 0) return [];
  const paths: string[] = [];
  for (const item of data) {
    const full = `${prefix}/${item.name}`;
    if (item.id === null) {
      paths.push(...(await listFolderRecursive(client, full)));
    } else {
      paths.push(full);
    }
  }
  return paths;
}

export async function deleteGameAdmin(game: GameRecord): Promise<void> {
  if (!supabase) throw new Error('Supabase is not connected.');

  if (game.storagePath) {
    const filePaths = await listFolderRecursive(supabase, game.storagePath);
    if (filePaths.length > 0) {
      await supabase.storage.from(GAMES_BUCKET).remove(filePaths);
    }
  }

  const thumbMarker = `/storage/v1/object/public/${THUMBNAILS_BUCKET}/`;
  const markerIdx = game.thumbnailUrl?.indexOf(thumbMarker) ?? -1;
  if (markerIdx !== -1) {
    const thumbObjectPath = decodeURIComponent(
      game.thumbnailUrl.slice(markerIdx + thumbMarker.length).split('?')[0]
    );
    if (thumbObjectPath) {
      await supabase.storage.from(THUMBNAILS_BUCKET).remove([thumbObjectPath]);
    }
  }

  const { error } = await supabase.from('games').delete().eq('id', game.id);
  if (error) {
    throw new Error(error.message);
  }
}
