import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminUserSession,
  BlockedSuggestionVisitorRecord,
  ExtractedGameFile,
  GameRecord,
  GameStatus,
  GameSuggestionRecord,
  ReplySenderType,
  SuggestionReplyRecord,
  SuggestionStatus,
  VisitorConversationRecord,
  VisitorInboxData,
} from '../types/game';
import {
  getRemainingCooldownSeconds,
  recordSuggestionSubmissionTime,
  validateSuggestionInput,
} from './suggestionValidation';
import { getVisitorTokenHash } from './visitorToken';
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
  how_to_play?: string | null;
  objective?: string | null;
  keyboard_controls?: string | null;
  mouse_controls?: string | null;
  touch_controls?: string | null;
  tips?: string | null;
  thumbnail_url?: string | null;
  game_entry_url?: string | null;
  game_url?: string | null;
  storage_path: string | null;
  status?: string | null;
  is_published?: boolean | null;
  created_at: string;
  updated_at?: string | null;
}

function isMissingGamesColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === 'PGRST204' || err.code === '42703') return true;
  const msg = err.message || '';
  return /could not find the '.*' column|column .* does not exist/i.test(msg);
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
    howToPlay: row.how_to_play ?? '',
    objective: row.objective ?? '',
    keyboardControls: row.keyboard_controls ?? '',
    mouseControls: row.mouse_controls ?? '',
    touchControls: row.touch_controls ?? '',
    tips: row.tips ?? '',
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
  howToPlay?: string;
  objective?: string;
  keyboardControls?: string;
  mouseControls?: string;
  touchControls?: string;
  tips?: string;
  status: GameStatus;
  entryPath: string;
  extractedFiles: ExtractedGameFile[];
  thumbnailFile?: File | null;
  thumbnailUrlFallback?: string;
  onProgress?: (label: string, percent: number) => void;
  onSchemaFallbackWarning?: (message: string) => void;
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

  const coreInsertPayload = {
    title: input.title.trim(),
    slug,
    description: input.description.trim(),
    thumbnail_url: finalThumbnailUrl,
    game_entry_url: entryData.publicUrl,
    storage_path: storageFolder,
    status: input.status,
    is_published: input.status === 'published',
  };

  const extraColumns = {
    how_to_play: (input.howToPlay || '').trim(),
    objective: (input.objective || '').trim(),
    keyboard_controls: (input.keyboardControls || '').trim(),
    mouse_controls: (input.mouseControls || '').trim(),
    touch_controls: (input.touchControls || '').trim(),
    tips: (input.tips || '').trim(),
  };
  const hasExtraValues = Object.values(extraColumns).some((val) => val.length > 0);

  let inserted: unknown = null;
  let dbErr: { code?: string; message?: string } | null = null;

  if (hasExtraValues) {
    const attempt = await supabase
      .from('games')
      .insert({ ...coreInsertPayload, ...extraColumns })
      .select()
      .single();
    inserted = attempt.data;
    dbErr = attempt.error;

    if (dbErr && isMissingGamesColumnError(dbErr)) {
      const fallbackAttempt = await supabase
        .from('games')
        .insert(coreInsertPayload)
        .select()
        .single();
      inserted = fallbackAttempt.data;
      dbErr = fallbackAttempt.error;
      if (!dbErr) {
        input.onSchemaFallbackWarning?.(
          'Game saved with core Description. Run the additive game details SQL migration to enable saving separate How to Play, Objective, Controls, and Tips columns.'
        );
      }
    }
  } else {
    const attempt = await supabase
      .from('games')
      .insert(coreInsertPayload)
      .select()
      .single();
    inserted = attempt.data;
    dbErr = attempt.error;
  }

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
    howToPlay?: string;
    objective?: string;
    keyboardControls?: string;
    mouseControls?: string;
    touchControls?: string;
    tips?: string;
    thumbnailUrl: string;
    thumbnailFile?: File | null;
    status: GameStatus;
    onSchemaFallbackWarning?: (message: string) => void;
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

  const coreUpdatePayload = {
    title: updates.title.trim(),
    description: updates.description.trim(),
    thumbnail_url: nextThumbUrl,
    status: updates.status,
    is_published: updates.status === 'published',
    updated_at: new Date().toISOString(),
  };

  const extraColumns = {
    how_to_play: (updates.howToPlay || '').trim(),
    objective: (updates.objective || '').trim(),
    keyboard_controls: (updates.keyboardControls || '').trim(),
    mouse_controls: (updates.mouseControls || '').trim(),
    touch_controls: (updates.touchControls || '').trim(),
    tips: (updates.tips || '').trim(),
  };
  const shouldAttemptExtraColumns =
    Object.values(extraColumns).some((val) => val.length > 0) ||
    Boolean(
      game.howToPlay ||
        game.objective ||
        game.keyboardControls ||
        game.mouseControls ||
        game.touchControls ||
        game.tips
    );

  let data: unknown = null;
  let error: { code?: string; message?: string } | null = null;

  if (shouldAttemptExtraColumns) {
    const attempt = await supabase
      .from('games')
      .update({ ...coreUpdatePayload, ...extraColumns })
      .eq('id', game.id)
      .select()
      .single();
    data = attempt.data;
    error = attempt.error;

    if (error && isMissingGamesColumnError(error)) {
      const fallbackAttempt = await supabase
        .from('games')
        .update(coreUpdatePayload)
        .eq('id', game.id)
        .select()
        .single();
      data = fallbackAttempt.data;
      error = fallbackAttempt.error;
      if (!error) {
        updates.onSchemaFallbackWarning?.(
          'Saved title, description, thumbnail, and status. Run the additive game details SQL migration to store separate How to Play, Objective, Controls, and Tips columns.'
        );
      }
    }
  } else {
    const attempt = await supabase
      .from('games')
      .update(coreUpdatePayload)
      .eq('id', game.id)
      .select()
      .single();
    data = attempt.data;
    error = attempt.error;
  }

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

interface DbSuggestionRow {
  id: string;
  message: string;
  visitor_token_hash: string;
  status: string;
  created_at: string;
  admin_read_at?: string | null;
}

interface DbSuggestionReplyRow {
  id: string;
  suggestion_id: string;
  sender_type: string;
  body: string;
  admin_user_id?: string | null;
  visitor_read_at?: string | null;
  created_at: string;
}

interface DbBlockedVisitorRow {
  id: string;
  visitor_token_hash: string;
  reason?: string | null;
  created_at: string;
  blocked_by?: string | null;
}

function isMissingMessagingSchemaError(
  err: { code?: string; message?: string } | null | undefined
): boolean {
  if (!err) return false;
  if (
    err.code === 'PGRST202' ||
    err.code === 'PGRST204' ||
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    err.code === '42703' ||
    err.code === '42883'
  ) {
    return true;
  }
  const msg = err.message || '';
  return /could not find the (function|table)|column .* does not exist|relation .* does not exist/i.test(
    msg
  );
}

function normalizeSuggestionStatus(raw: string): SuggestionStatus {
  if (raw === 'reviewed' || raw === 'archived') return raw;
  return 'new';
}

function normalizeSenderType(raw: string): ReplySenderType {
  return raw === 'visitor' ? 'visitor' : 'admin';
}

function mapSuggestionReplyRow(row: DbSuggestionReplyRow): SuggestionReplyRecord {
  return {
    id: row.id,
    suggestionId: row.suggestion_id,
    senderType: normalizeSenderType(row.sender_type),
    body: row.body,
    adminUserId: row.admin_user_id ?? null,
    visitorReadAt: row.visitor_read_at ?? null,
    createdAt: row.created_at,
  };
}

function deduplicateReplies(replies: SuggestionReplyRecord[]): SuggestionReplyRecord[] {
  const seen = new Set<string>();
  const unique: SuggestionReplyRecord[] = [];
  for (const r of replies) {
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    unique.push(r);
  }
  unique.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return unique;
}

function mapSuggestionRow(
  row: DbSuggestionRow,
  replies: SuggestionReplyRecord[] = []
): GameSuggestionRecord {
  return {
    id: row.id,
    message: row.message,
    visitorTokenHash: row.visitor_token_hash,
    status: normalizeSuggestionStatus(row.status),
    createdAt: row.created_at,
    adminReadAt: row.admin_read_at ?? null,
    replies: deduplicateReplies(replies),
  };
}

function mapBlockedVisitorRow(row: DbBlockedVisitorRow): BlockedSuggestionVisitorRecord {
  return {
    id: row.id,
    visitorTokenHash: row.visitor_token_hash,
    reason: row.reason ?? '',
    createdAt: row.created_at,
    blockedBy: row.blocked_by ?? null,
  };
}

export interface SubmitSuggestionResult {
  ok: boolean;
  code: string;
  message: string;
}

export async function submitGameSuggestion(rawMessage: string): Promise<SubmitSuggestionResult> {
  const validation = validateSuggestionInput(rawMessage);
  if (!validation.valid) {
    return {
      ok: false,
      code: 'validation_error',
      message: validation.error || 'Please check your game suggestion and try again.',
    };
  }

  const remainingCooldown = getRemainingCooldownSeconds();
  if (remainingCooldown > 0) {
    return {
      ok: false,
      code: 'rate_limited',
      message: `Please wait ${remainingCooldown} seconds before sending another game suggestion.`,
    };
  }

  if (!supabase) {
    return {
      ok: false,
      code: 'not_configured',
      message: 'Suggestions are currently unavailable while the game library service is offline.',
    };
  }

  const visitorTokenHash = await getVisitorTokenHash();

  const { data, error } = await supabase.rpc('submit_game_suggestion', {
    p_message: validation.cleaned,
    p_visitor_token_hash: visitorTokenHash,
  });

  if (error) {
    console.error('[Play Aura] submit_game_suggestion RPC failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    const isMissingMigration =
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      /could not find the function/i.test(error.message || '');
    return {
      ok: false,
      code: isMissingMigration ? 'migration_required' : 'server_error',
      message: isMissingMigration
        ? 'The suggestions database function is not installed yet on Supabase. Please run the suggestions SQL migration and try again.'
        : 'We could not send your suggestion right now. Please try again shortly.',
    };
  }

  const payload = (data || {}) as { ok?: boolean; code?: string; error?: string };
  if (!payload.ok) {
    return {
      ok: false,
      code: payload.code || 'rejected',
      message: payload.error || 'Unable to submit your suggestion right now.',
    };
  }

  recordSuggestionSubmissionTime();
  return {
    ok: true,
    code: payload.code || 'created',
    message: 'Thank you! Your game suggestion has been sent to Play Aura.',
  };
}

export async function fetchAllSuggestionsWithRepliesAdmin(): Promise<{
  suggestions: GameSuggestionRecord[];
  messagingSupported: boolean;
}> {
  if (!supabase) throw new Error('Supabase is not connected.');

  let messagingSupported = true;
  let suggestionRows: DbSuggestionRow[] = [];

  const primaryQuery = await supabase
    .from('game_suggestions')
    .select('id, message, visitor_token_hash, status, created_at, admin_read_at')
    .order('created_at', { ascending: false });

  if (primaryQuery.error) {
    if (!isMissingMessagingSchemaError(primaryQuery.error)) {
      throw new Error(primaryQuery.error.message || 'Unable to load game suggestions.');
    }
    messagingSupported = false;
    const legacyQuery = await supabase
      .from('game_suggestions')
      .select('id, message, visitor_token_hash, status, created_at')
      .order('created_at', { ascending: false });
    if (legacyQuery.error) {
      throw new Error(legacyQuery.error.message || 'Unable to load game suggestions.');
    }
    suggestionRows = (legacyQuery.data || []) as DbSuggestionRow[];
  } else {
    suggestionRows = (primaryQuery.data || []) as DbSuggestionRow[];
  }

  const repliesBySuggestion = new Map<string, SuggestionReplyRecord[]>();

  if (messagingSupported) {
    const repliesQuery = await supabase
      .from('suggestion_replies')
      .select('id, suggestion_id, sender_type, body, admin_user_id, visitor_read_at, created_at')
      .order('created_at', { ascending: true });

    if (repliesQuery.error) {
      if (isMissingMessagingSchemaError(repliesQuery.error)) {
        messagingSupported = false;
      } else {
        throw new Error(repliesQuery.error.message || 'Unable to load conversation replies.');
      }
    } else {
      for (const row of (repliesQuery.data || []) as DbSuggestionReplyRow[]) {
        const mapped = mapSuggestionReplyRow(row);
        const list = repliesBySuggestion.get(mapped.suggestionId) || [];
        list.push(mapped);
        repliesBySuggestion.set(mapped.suggestionId, list);
      }
    }
  }

  return {
    messagingSupported,
    suggestions: suggestionRows.map((row) =>
      mapSuggestionRow(row, repliesBySuggestion.get(row.id) || [])
    ),
  };
}

export async function fetchAllSuggestionsAdmin(): Promise<GameSuggestionRecord[]> {
  const res = await fetchAllSuggestionsWithRepliesAdmin();
  return res.suggestions;
}

export async function updateSuggestionStatusAdmin(
  id: string,
  status: SuggestionStatus
): Promise<GameSuggestionRecord> {
  if (!supabase) throw new Error('Supabase is not connected.');
  const attempt = await supabase
    .from('game_suggestions')
    .update({ status })
    .eq('id', id)
    .select('id, message, visitor_token_hash, status, created_at, admin_read_at')
    .single();

  if (attempt.error && isMissingMessagingSchemaError(attempt.error)) {
    const legacy = await supabase
      .from('game_suggestions')
      .update({ status })
      .eq('id', id)
      .select('id, message, visitor_token_hash, status, created_at')
      .single();
    if (legacy.error || !legacy.data) {
      throw new Error(legacy.error?.message || 'Could not update suggestion status.');
    }
    return mapSuggestionRow(legacy.data as DbSuggestionRow);
  }

  if (attempt.error || !attempt.data) {
    throw new Error(attempt.error?.message || 'Could not update suggestion status.');
  }
  return mapSuggestionRow(attempt.data as DbSuggestionRow);
}

export async function markSuggestionReadAdmin(suggestionId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('mark_suggestion_read_admin', {
    p_suggestion_id: suggestionId,
  });

  if (error) {
    if (isMissingMessagingSchemaError(error)) {
      return null;
    }
    throw new Error(error.message || 'Could not mark message as read.');
  }

  const payload = (data || {}) as { ok?: boolean; admin_read_at?: string | null };
  if (!payload.ok) return null;
  return payload.admin_read_at ?? new Date().toISOString();
}

export async function sendAdminSuggestionReply(
  suggestionId: string,
  rawBody: string
): Promise<{
  reply: SuggestionReplyRecord;
  suggestionStatus: SuggestionStatus;
  adminReadAt: string | null;
}> {
  if (!supabase) throw new Error('Supabase is not connected.');
  const cleanBody = rawBody.trim();
  if (!cleanBody) {
    throw new Error('Please enter a reply message before sending.');
  }
  if (cleanBody.length > 2000) {
    throw new Error('Replies must be 2000 characters or fewer.');
  }

  const { data, error } = await supabase.rpc('send_admin_suggestion_reply', {
    p_suggestion_id: suggestionId,
    p_body: cleanBody,
  });

  if (error) {
    if (isMissingMessagingSchemaError(error)) {
      throw new Error(
        'The visitor messaging SQL migration is not installed yet on Supabase. Run 20261122_visitor_messaging.sql in your Supabase SQL Editor first.'
      );
    }
    throw new Error(error.message || 'Could not send reply.');
  }

  const payload = (data || {}) as {
    ok?: boolean;
    error?: string;
    reply?: DbSuggestionReplyRow;
    suggestion?: { id?: string; status?: string; admin_read_at?: string | null };
  };

  if (!payload.ok || !payload.reply) {
    throw new Error(payload.error || 'Could not send reply.');
  }

  return {
    reply: mapSuggestionReplyRow(payload.reply),
    suggestionStatus: normalizeSuggestionStatus(payload.suggestion?.status || 'reviewed'),
    adminReadAt: payload.suggestion?.admin_read_at ?? new Date().toISOString(),
  };
}

export async function deleteSuggestionAdmin(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not connected.');
  const { error } = await supabase.from('game_suggestions').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Could not delete suggestion.');
  }
}

export async function fetchBlockedSuggestionVisitorsAdmin(): Promise<BlockedSuggestionVisitorRecord[]> {
  if (!supabase) throw new Error('Supabase is not connected.');
  const { data, error } = await supabase
    .from('blocked_suggestion_visitors')
    .select('id, visitor_token_hash, reason, created_at, blocked_by')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Unable to load blocked visitors.');
  }
  return ((data || []) as DbBlockedVisitorRow[]).map(mapBlockedVisitorRow);
}

export async function blockSuggestionVisitorAdmin(
  visitorTokenHash: string,
  blockedByUserId: string,
  reason = ''
): Promise<BlockedSuggestionVisitorRecord> {
  if (!supabase) throw new Error('Supabase is not connected.');
  const { data, error } = await supabase
    .from('blocked_suggestion_visitors')
    .upsert(
      {
        visitor_token_hash: visitorTokenHash,
        reason: reason.trim(),
        blocked_by: blockedByUserId,
      },
      { onConflict: 'visitor_token_hash' }
    )
    .select('id, visitor_token_hash, reason, created_at, blocked_by')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Could not block visitor.');
  }
  return mapBlockedVisitorRow(data as DbBlockedVisitorRow);
}

export async function unblockSuggestionVisitorAdmin(visitorTokenHash: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not connected.');
  const { error } = await supabase
    .from('blocked_suggestion_visitors')
    .delete()
    .eq('visitor_token_hash', visitorTokenHash);

  if (error) {
    throw new Error(error.message || 'Could not unblock visitor.');
  }
}

interface RawVisitorConversationPayload {
  id: string;
  message: string;
  status: string;
  created_at: string;
  reply_count?: number;
  unread_reply_count?: number;
  latest_activity_at?: string;
  replies?: DbSuggestionReplyRow[];
}

function mapVisitorConversation(raw: RawVisitorConversationPayload): VisitorConversationRecord {
  const replies = deduplicateReplies((raw.replies || []).map(mapSuggestionReplyRow));
  const unreadReplyCount =
    typeof raw.unread_reply_count === 'number'
      ? raw.unread_reply_count
      : replies.filter((r) => r.senderType === 'admin' && !r.visitorReadAt).length;
  return {
    id: raw.id,
    message: raw.message,
    status: normalizeSuggestionStatus(raw.status),
    createdAt: raw.created_at,
    replyCount: typeof raw.reply_count === 'number' ? raw.reply_count : replies.length,
    unreadReplyCount,
    latestActivityAt:
      raw.latest_activity_at ||
      (replies.length > 0 ? replies[replies.length - 1].createdAt : raw.created_at),
    replies,
  };
}

export async function fetchVisitorInbox(): Promise<VisitorInboxData> {
  if (!supabase) {
    return { supported: false, unreadCount: 0, conversations: [] };
  }

  const visitorTokenHash = await getVisitorTokenHash();
  const { data, error } = await supabase.rpc('get_visitor_inbox', {
    p_visitor_token_hash: visitorTokenHash,
  });

  if (error) {
    if (isMissingMessagingSchemaError(error)) {
      return { supported: false, unreadCount: 0, conversations: [] };
    }
    throw new Error(error.message || 'Unable to load notifications right now.');
  }

  const payload = (data || {}) as {
    ok?: boolean;
    unread_count?: number;
    conversations?: RawVisitorConversationPayload[];
  };

  if (!payload.ok) {
    return { supported: true, unreadCount: 0, conversations: [] };
  }

  const seenConvIds = new Set<string>();
  const conversations: VisitorConversationRecord[] = [];
  for (const item of payload.conversations || []) {
    if (!item?.id || seenConvIds.has(item.id)) continue;
    seenConvIds.add(item.id);
    conversations.push(mapVisitorConversation(item));
  }

  const unreadCount =
    typeof payload.unread_count === 'number'
      ? payload.unread_count
      : conversations.reduce((sum, c) => sum + c.unreadReplyCount, 0);

  return {
    supported: true,
    unreadCount,
    conversations,
  };
}

export async function fetchVisitorConversation(
  suggestionId: string
): Promise<VisitorConversationRecord | null> {
  if (!supabase) return null;
  const visitorTokenHash = await getVisitorTokenHash();
  const { data, error } = await supabase.rpc('get_visitor_conversation', {
    p_suggestion_id: suggestionId,
    p_visitor_token_hash: visitorTokenHash,
  });

  if (error) {
    if (isMissingMessagingSchemaError(error)) return null;
    throw new Error(error.message || 'Unable to load conversation.');
  }

  const payload = (data || {}) as {
    ok?: boolean;
    conversation?: RawVisitorConversationPayload;
  };
  if (!payload.ok || !payload.conversation) {
    return null;
  }

  return mapVisitorConversation(payload.conversation);
}

export async function markVisitorRepliesRead(
  suggestionId?: string
): Promise<{ unreadCount: number; readAt: string | null }> {
  if (!supabase) {
    return { unreadCount: 0, readAt: null };
  }
  const visitorTokenHash = await getVisitorTokenHash();
  const { data, error } = await supabase.rpc('mark_visitor_replies_read', {
    p_visitor_token_hash: visitorTokenHash,
    p_suggestion_id: suggestionId ?? null,
  });

  if (error) {
    if (isMissingMessagingSchemaError(error)) {
      return { unreadCount: 0, readAt: null };
    }
    throw new Error(error.message || 'Unable to mark replies as read.');
  }

  const payload = (data || {}) as {
    ok?: boolean;
    unread_count?: number;
    read_at?: string | null;
  };

  return {
    unreadCount: typeof payload.unread_count === 'number' ? payload.unread_count : 0,
    readAt: payload.read_at ?? new Date().toISOString(),
  };
}
