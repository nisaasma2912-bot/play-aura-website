import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileArchive,
  FilePenLine,
  Loader2,
  Lock,
  LogOut,
  MessageSquarePlus,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { AdminSuggestionsPanel } from './AdminSuggestionsPanel';
import {
  UnauthorizedAdminError,
  deleteGameAdmin,
  fetchAllGamesForAdmin,
  fetchAllSuggestionsWithRepliesAdmin,
  isSupabaseConfigured,
  signInAdmin,
  signOutAdmin,
  updateGameAdmin,
  updateGameStatusAdmin,
  uploadAndCreateGame,
} from '../lib/supabase';
import { buildLocalZipPreviewHtml, validateAndExtractGameZip } from '../lib/zipValidator';
import { GameThumbnail } from './GameThumbnail';
import type {
  AdminUserSession,
  GameRecord,
  GameStatus,
  ZipValidationResult,
} from '../types/game';

interface AdminPortalProps {
  session: AdminUserSession | null;
  checkingSession?: boolean;
  onSessionChange: (session: AdminUserSession | null) => void;
  onUnauthorizedRedirect?: () => void;
  onLibraryUpdated: () => void;
  onPlayGame: (game: GameRecord) => void;
  onBackToGames: () => void;
}

const STATUS_OPTIONS: Array<{ value: GameStatus; label: string }> = [
  { value: 'draft', label: 'Draft (Preview before publishing)' },
  { value: 'published', label: 'Published (Live on homepage)' },
  { value: 'unpublished', label: 'Unpublished (Hidden from visitors)' },
];

export function AdminPortal({
  session,
  checkingSession = false,
  onSessionChange,
  onUnauthorizedRedirect,
  onLibraryUpdated,
  onPlayGame,
  onBackToGames,
}: AdminPortalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [games, setGames] = useState<GameRecord[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryStatusFilter, setLibraryStatusFilter] = useState<'all' | GameStatus>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [adminSection, setAdminSection] = useState<'games' | 'suggestions'>('games');
  const [newSuggestionsCount, setNewSuggestionsCount] = useState<number>(0);

  // Upload New Game section state
  const [uploadExpanded, setUploadExpanded] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [howToPlay, setHowToPlay] = useState('');
  const [objective, setObjective] = useState('');
  const [keyboardControls, setKeyboardControls] = useState('');
  const [mouseControls, setMouseControls] = useState('');
  const [touchControls, setTouchControls] = useState('');
  const [tips, setTips] = useState('');
  const [initialStatus, setInitialStatus] = useState<GameStatus>('draft');
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string>('');
  const [thumbUrlInput, setThumbUrlInput] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipValidation, setZipValidation] = useState<ZipValidationResult | null>(null);
  const [validatingZip, setValidatingZip] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ label: '', percent: 0 });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const localPreviewRevokeRef = useRef<(() => void) | null>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Edit modal state
  const [editingGame, setEditingGame] = useState<GameRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editHowToPlay, setEditHowToPlay] = useState('');
  const [editObjective, setEditObjective] = useState('');
  const [editKeyboardControls, setEditKeyboardControls] = useState('');
  const [editMouseControls, setEditMouseControls] = useState('');
  const [editTouchControls, setEditTouchControls] = useState('');
  const [editTips, setEditTips] = useState('');
  const [editThumbUrl, setEditThumbUrl] = useState('');
  const [editThumbFile, setEditThumbFile] = useState<File | null>(null);
  const [editThumbPreviewUrl, setEditThumbPreviewUrl] = useState<string>('');
  const [editStatus, setEditStatus] = useState<GameStatus>('draft');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deletingGame, setDeletingGame] = useState<GameRecord | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const loadAdminLibrary = async () => {
    if (!session || !isSupabaseConfigured) return;
    setLoadingGames(true);
    setLibraryError(null);
    try {
      const list = await fetchAllGamesForAdmin();
      setGames(list);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Unable to load your admin library.');
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    if (session) {
      void loadAdminLibrary();
      void fetchAllSuggestionsWithRepliesAdmin()
        .then((res) => {
          setNewSuggestionsCount(
            res.suggestions.filter((s) => s.status === 'new' || !s.adminReadAt).length
          );
        })
        .catch(() => {
          // Non-blocking badge preload
        });
    } else {
      setGames([]);
      setNewSuggestionsCount(0);
    }
  }, [session]);

  useEffect(() => {
    if (!thumbFile) {
      setThumbPreviewUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(thumbFile);
    setThumbPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [thumbFile]);

  useEffect(() => {
    if (!editThumbFile) {
      setEditThumbPreviewUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(editThumbFile);
    setEditThumbPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [editThumbFile]);

  useEffect(() => {
    return () => {
      localPreviewRevokeRef.current?.();
    };
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const nextSession = await signInAdmin(email, password);
      onSessionChange(nextSession);
      setPassword('');
    } catch (err) {
      if (err instanceof UnauthorizedAdminError) {
        onSessionChange(null);
        onUnauthorizedRedirect?.();
        return;
      }
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutAdmin();
    onSessionChange(null);
  };

  const handleZipSelect = async (file: File | null) => {
    localPreviewRevokeRef.current?.();
    localPreviewRevokeRef.current = null;
    setZipFile(file);
    setZipValidation(null);
    setUploadError(null);
    if (!file) return;

    setValidatingZip(true);
    try {
      const result = await validateAndExtractGameZip(file);
      setZipValidation(result);
    } finally {
      setValidatingZip(false);
    }
  };

  const handlePreviewLocalZip = () => {
    if (!zipValidation?.valid || !zipValidation.entryPath) return;
    localPreviewRevokeRef.current?.();
    const { html, revoke } = buildLocalZipPreviewHtml(
      zipValidation.files,
      zipValidation.entryPath
    );
    localPreviewRevokeRef.current = revoke;

    onPlayGame({
      id: `local-preview-${Date.now()}`,
      title: title.trim() || zipFile?.name.replace(/\.zip$/i, '') || 'ZIP Preview',
      slug: 'local-preview',
      description: description.trim(),
      howToPlay: howToPlay.trim(),
      objective: objective.trim(),
      keyboardControls: keyboardControls.trim(),
      mouseControls: mouseControls.trim(),
      touchControls: touchControls.trim(),
      tips: tips.trim(),
      thumbnailUrl: thumbPreviewUrl || thumbUrlInput.trim(),
      gameEntryUrl: '',
      gameSrcDoc: html,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });
  };

  const resetUploadForm = () => {
    localPreviewRevokeRef.current?.();
    localPreviewRevokeRef.current = null;
    setTitle('');
    setDescription('');
    setHowToPlay('');
    setObjective('');
    setKeyboardControls('');
    setMouseControls('');
    setTouchControls('');
    setTips('');
    setInitialStatus('draft');
    setThumbFile(null);
    setThumbUrlInput('');
    setZipFile(null);
    setZipValidation(null);
    setUploadError(null);
    setUploadProgress({ label: '', percent: 0 });
    if (thumbInputRef.current) thumbInputRef.current.value = '';
    if (zipInputRef.current) zipInputRef.current.value = '';
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!zipValidation || !zipValidation.valid || !zipValidation.entryPath) {
      setUploadError('Please select a valid HTML5 game ZIP archive containing an index.html file.');
      return;
    }
    if (!title.trim()) {
      setUploadError('Please enter a game title.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setActionNotice(null);
    let fallbackWarning: string | null = null;
    try {
      const created = await uploadAndCreateGame({
        title,
        description,
        howToPlay,
        objective,
        keyboardControls,
        mouseControls,
        touchControls,
        tips,
        status: initialStatus,
        entryPath: zipValidation.entryPath,
        extractedFiles: zipValidation.files,
        thumbnailFile: thumbFile,
        thumbnailUrlFallback: thumbUrlInput,
        onProgress: (label, percent) => setUploadProgress({ label, percent }),
        onSchemaFallbackWarning: (msg) => {
          fallbackWarning = msg;
        },
      });
      setGames((prev) => [created, ...prev]);
      onLibraryUpdated();
      setActionNotice(
        fallbackWarning ||
          `"${created.title}" uploaded as ${created.status === 'published' ? 'Published' : created.status === 'draft' ? 'Draft' : 'Unpublished'}.`
      );
      resetUploadForm();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (g: GameRecord) => {
    setEditingGame(g);
    setEditTitle(g.title);
    setEditDesc(g.description);
    setEditHowToPlay(g.howToPlay || '');
    setEditObjective(g.objective || '');
    setEditKeyboardControls(g.keyboardControls || '');
    setEditMouseControls(g.mouseControls || '');
    setEditTouchControls(g.touchControls || '');
    setEditTips(g.tips || '');
    setEditThumbUrl(g.thumbnailUrl);
    setEditThumbFile(null);
    setEditStatus(g.status);
    setEditError(null);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingGame) return;
    if (!editTitle.trim()) {
      setEditError('Game title is required.');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    let fallbackWarning: string | null = null;
    try {
      const updated = await updateGameAdmin(editingGame, {
        title: editTitle,
        description: editDesc,
        howToPlay: editHowToPlay,
        objective: editObjective,
        keyboardControls: editKeyboardControls,
        mouseControls: editMouseControls,
        touchControls: editTouchControls,
        tips: editTips,
        thumbnailUrl: editThumbUrl,
        thumbnailFile: editThumbFile,
        status: editStatus,
        onSchemaFallbackWarning: (msg) => {
          fallbackWarning = msg;
        },
      });
      setGames((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onLibraryUpdated();
      setActionNotice(fallbackWarning || `Saved changes to "${updated.title}".`);
      setEditingGame(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleStatusChange = async (g: GameRecord, nextStatus: GameStatus) => {
    setLibraryError(null);
    setActionNotice(null);
    try {
      const updated = await updateGameStatusAdmin(g.id, nextStatus);
      setGames((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onLibraryUpdated();
      setActionNotice(
        `"${updated.title}" is now ${
          nextStatus === 'published'
            ? 'Published'
            : nextStatus === 'draft'
              ? 'Draft'
              : 'Unpublished'
        }.`
      );
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Could not update game status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingGame) return;
    setDeletingBusy(true);
    setLibraryError(null);
    try {
      await deleteGameAdmin(deletingGame);
      setGames((prev) => prev.filter((item) => item.id !== deletingGame.id));
      onLibraryUpdated();
      setActionNotice(`Deleted "${deletingGame.title}" from your library.`);
      setDeletingGame(null);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Could not delete game.');
    } finally {
      setDeletingBusy(false);
    }
  };

  const filteredLibrary = useMemo(() => {
    if (libraryStatusFilter === 'all') return games;
    return games.filter((g) => g.status === libraryStatusFilter);
  }, [games, libraryStatusFilter]);

  const publishedCount = games.filter((g) => g.status === 'published').length;
  const draftCount = games.filter((g) => g.status === 'draft').length;
  const unpublishedCount = games.filter((g) => g.status === 'unpublished').length;

  // Gate 1: Honest locked state when backend auth is not connected yet (no technical details shown to visitors)
  if (!isSupabaseConfigured) {
    return (
      <section className="max-w-lg mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-[32px] bg-white border-2 border-[#EAE5FA] p-7 sm:p-9 bubble-shadow text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#EAE5FA] text-[#4B3D8F] flex items-center justify-center">
            <Lock className="w-7 h-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#2B3445]">
              Private Admin Area
            </h1>
            <p className="text-sm sm:text-base text-[#5A657A] mt-2 leading-relaxed">
              This area is reserved for the Play Aura site administrator. Sign-in will become available once administrator authentication is enabled by the site owner.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToGames}
            className="bubble-button rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] text-[#1D6B52] px-7 py-3 font-bold text-sm cursor-pointer"
          >
            Back to Games
          </button>
        </div>
      </section>
    );
  }

  // Gate 1.5: Session & admin role check in progress
  if (checkingSession) {
    return (
      <section className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-[32px] bg-white border-2 border-[#CBE7FA] p-10 text-center bubble-shadow space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1E5B8A] mx-auto" aria-hidden="true" />
          <p className="font-display text-xl font-bold text-[#2B3445]">
            Verifying administrator access...
          </p>
        </div>
      </section>
    );
  }

  // Gate 2: Real Supabase Auth Login
  if (!session) {
    return (
      <section className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-[32px] bg-white border-2 border-[#CBE7FA] p-7 sm:p-9 bubble-shadow">
          <div className="w-12 h-12 rounded-full bg-[#DDF0FC] text-[#1E5B8A] flex items-center justify-center mb-4">
            <Lock className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#2B3445]">
            Admin Sign In
          </h1>
          <p className="text-sm text-[#5A657A] mt-1 mb-6">
            Only authorized Play Aura administrators can upload, edit, publish, or delete games.
          </p>

          {authError && (
            <div
              role="alert"
              className="mb-4 rounded-2xl bg-[#FAF5E8] border border-[#C8BCF2] p-3.5 text-sm font-semibold text-[#4B3D8F] flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-bold text-[#2B3445] mb-1.5">
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-full bg-[#FFFDF6] border-2 border-[#CBE7FA] px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#8AD8B5]"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-bold text-[#2B3445] mb-1.5">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-full bg-[#FFFDF6] border-2 border-[#CBE7FA] px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#8AD8B5]"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="bubble-button w-full rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] disabled:opacity-60 text-[#1D6B52] py-3 font-bold text-sm cursor-pointer"
            >
              {authLoading ? 'Signing In...' : 'Sign In to Admin Dashboard'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  // Gate 3: Authenticated Admin Dashboard
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Top Admin Header */}
      <div className="rounded-[28px] bg-white border-2 border-[#D8F3E5] p-5 sm:p-7 bubble-shadow flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#2B3445]">
            Play Aura Admin Dashboard
          </h1>
          <p className="text-sm text-[#5A657A] mt-1">
            Signed in as <strong className="text-[#1D6B52]">{session.email}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {adminSection === 'games' && (
            <button
              type="button"
              onClick={() => setUploadExpanded((prev) => !prev)}
              className="bubble-button inline-flex items-center gap-2 rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] text-[#1D6B52] px-5 py-2.5 text-sm font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{uploadExpanded ? 'Hide Upload Form' : 'Upload New Game'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className="bubble-button inline-flex items-center gap-2 rounded-full bg-[#FAF5E8] hover:bg-[#EAE5FA] text-[#4B3D8F] px-4 py-2.5 text-sm font-bold cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Admin Portal Section Navigation: Games vs Suggestions */}
      <div
        role="tablist"
        aria-label="Admin sections"
        className="inline-flex flex-wrap items-center gap-2 p-1.5 rounded-full bg-white border-2 border-[#CBE7FA] bubble-shadow"
      >
        <button
          type="button"
          role="tab"
          aria-selected={adminSection === 'games'}
          onClick={() => setAdminSection('games')}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
            adminSection === 'games'
              ? 'bg-[#D8F3E5] text-[#1D6B52]'
              : 'text-[#5A657A] hover:text-[#2B3445]'
          }`}
        >
          <span>Games Library</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={adminSection === 'suggestions'}
          onClick={() => setAdminSection('suggestions')}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
            adminSection === 'suggestions'
              ? 'bg-[#DDF0FC] text-[#1E5B8A]'
              : 'text-[#5A657A] hover:text-[#2B3445]'
          }`}
        >
          <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
          <span>
            Suggestions{newSuggestionsCount > 0 ? ` (${newSuggestionsCount} new)` : ''}
          </span>
        </button>
      </div>

      {adminSection === 'suggestions' ? (
        <AdminSuggestionsPanel
          session={session}
          onNewCountChange={setNewSuggestionsCount}
        />
      ) : (
        <>
          {/* Real Library Counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] bg-[#FAF5E8] border border-[#EAE3CE] p-5">
          <div className="text-xs font-bold text-[#5A657A]">Total Uploaded</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {games.length}
          </div>
        </div>
        <div className="rounded-[24px] bg-[#D8F3E5]/60 border border-[#BFEAD6] p-5">
          <div className="text-xs font-bold text-[#1D6B52]">Published</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {publishedCount}
          </div>
        </div>
        <div className="rounded-[24px] bg-[#DDF0FC]/65 border border-[#CBE7FA] p-5">
          <div className="text-xs font-bold text-[#1E5B8A]">Drafts</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {draftCount}
          </div>
        </div>
        <div className="rounded-[24px] bg-[#EAE5FA]/65 border border-[#DFD7F8] p-5">
          <div className="text-xs font-bold text-[#4B3D8F]">Unpublished</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {unpublishedCount}
          </div>
        </div>
      </div>

      {actionNotice && (
        <div
          role="status"
          className="rounded-2xl bg-[#D8F3E5]/70 border border-[#8AD8B5] px-4 py-3 text-sm font-bold text-[#1D6B52] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            aria-label="Dismiss notice"
            className="p-1 rounded-full hover:bg-white/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Prominent Upload New Game Section */}
      {uploadExpanded && (
        <div className="rounded-[28px] bg-white border-2 border-[#CBE7FA] p-5 sm:p-8 bubble-shadow space-y-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#2B3445]">Upload New Game</h2>
            <p className="text-sm text-[#5A657A] mt-1">
              Upload an HTML5 game ZIP archive containing an <code className="font-mono text-[#4B3D8F]">index.html</code> file. Preview your game in the player before publishing it to the homepage.
            </p>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div>
                  <label htmlFor="up-title" className="block text-sm font-bold text-[#2B3445] mb-1.5">
                    Game Title
                  </label>
                  <input
                    id="up-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Sunny Cloud Quest"
                    className="w-full rounded-full bg-[#FFFDF6] border-2 border-[#CBE7FA] px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#8AD8B5]"
                  />
                </div>

                <div>
                  <label htmlFor="up-status" className="block text-sm font-bold text-[#2B3445] mb-1.5">
                    Initial Status
                  </label>
                  <select
                    id="up-status"
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value as GameStatus)}
                    className="w-full rounded-full bg-[#FFFDF6] border-2 border-[#CBE7FA] px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#8AD8B5]"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="up-desc" className="block text-sm font-bold text-[#2B3445] mb-1.5">
                    Description
                  </label>
                  <textarea
                    id="up-desc"
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Write a clear game overview for players..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border-2 border-[#CBE7FA] px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="up-thumb" className="block text-sm font-bold text-[#2B3445] mb-1.5">
                    Thumbnail Image
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={thumbInputRef}
                      id="up-thumb"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#5A657A] file:mr-3 file:rounded-full file:border-0 file:bg-[#EAE5FA] file:px-4 file:py-2 file:text-xs file:font-bold file:text-[#4B3D8F] cursor-pointer"
                    />
                    {thumbPreviewUrl && (
                      <img
                        src={thumbPreviewUrl}
                        alt="Thumbnail preview"
                        className="w-16 h-12 rounded-xl object-cover border border-[#CBE7FA] shrink-0"
                      />
                    )}
                  </div>
                  <input
                    type="url"
                    value={thumbUrlInput}
                    onChange={(e) => setThumbUrlInput(e.target.value)}
                    placeholder="Or paste an optional thumbnail image URL"
                    aria-label="Optional thumbnail URL"
                    className="mt-2 w-full rounded-full bg-[#FFFDF6] border border-[#EAE3CE] px-4 py-2 text-xs font-semibold focus:outline-none focus:border-[#8AD8B5]"
                  />
                </div>

                <div>
                  <label htmlFor="up-zip" className="block text-sm font-bold text-[#2B3445] mb-1.5">
                    HTML5 Game ZIP File
                  </label>
                  <label
                    htmlFor="up-zip"
                    className="flex flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-[#8AC5F0] bg-[#FAF5E8] p-5 text-center cursor-pointer hover:bg-[#DDF0FC]/40 transition-colors"
                  >
                    <UploadCloud className="w-7 h-7 text-[#1E5B8A]" aria-hidden="true" />
                    <span className="text-sm font-bold text-[#2B3445] break-all">
                      {zipFile ? zipFile.name : 'Choose .zip archive containing index.html'}
                    </span>
                    <span className="text-xs text-[#5A657A]">
                      Max 100 MB · Checks for index.html &amp; blocks unsafe files
                    </span>
                    <input
                      ref={zipInputRef}
                      id="up-zip"
                      type="file"
                      accept=".zip,application/zip"
                      onChange={(e) => void handleZipSelect(e.target.files?.[0] || null)}
                      className="sr-only"
                    />
                  </label>

                  {validatingZip && (
                    <div className="mt-2 flex items-center gap-2 text-xs font-bold text-[#1E5B8A]">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Validating ZIP contents...</span>
                    </div>
                  )}

                  {zipValidation && (
                    <div
                      className={`mt-3 rounded-2xl p-3.5 text-xs space-y-1.5 border ${
                        zipValidation.valid
                          ? 'bg-[#D8F3E5]/60 border-[#8AD8B5] text-[#1D6B52]'
                          : 'bg-[#FAF5E8] border-[#C8BCF2] text-[#4B3D8F]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        {zipValidation.valid ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>
                              Ready: {zipValidation.fileCount} files · Entry:{' '}
                              {zipValidation.entryPath} (
                              {(zipValidation.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB)
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>ZIP validation failed</span>
                          </>
                        )}
                      </div>

                      {zipValidation.valid && (
                        <div className="text-[#2B3445] font-semibold">
                          {[
                            zipValidation.assetSummary.images > 0 &&
                              `${zipValidation.assetSummary.images} images/textures`,
                            zipValidation.assetSummary.models3d > 0 &&
                              `${zipValidation.assetSummary.models3d} 3D assets`,
                            zipValidation.assetSummary.scripts > 0 &&
                              `${zipValidation.assetSummary.scripts} scripts/WASM`,
                            zipValidation.assetSummary.styles > 0 &&
                              `${zipValidation.assetSummary.styles} stylesheets`,
                            zipValidation.assetSummary.audio > 0 &&
                              `${zipValidation.assetSummary.audio} audio`,
                            zipValidation.assetSummary.video > 0 &&
                              `${zipValidation.assetSummary.video} video`,
                            zipValidation.assetSummary.fonts > 0 &&
                              `${zipValidation.assetSummary.fonts} fonts`,
                            zipValidation.assetSummary.data > 0 &&
                              `${zipValidation.assetSummary.data} data/config`,
                            zipValidation.assetSummary.other > 0 &&
                              `${zipValidation.assetSummary.other} other files`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}

                      {zipValidation.errors.map((errMsg, idx) => (
                        <div key={idx}>{errMsg}</div>
                      ))}

                      {zipValidation.missingDependencies.length > 0 && (
                        <div className="mt-1.5 rounded-xl bg-[#FAF5E8] border border-[#C8BCF2] p-2.5 text-[#4B3D8F] space-y-1">
                          <div className="font-bold">Missing dependencies detected inside ZIP:</div>
                          {zipValidation.missingDependencies.map((dep, idx) => (
                            <div key={idx}>{dep}</div>
                          ))}
                        </div>
                      )}

                      {zipValidation.warnings.map((warnMsg, idx) => (
                        <div key={idx} className="text-[#5A657A]">
                          Note: {warnMsg}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Optional Structured Instructions, Objective, Controls & Tips */}
            <details className="rounded-2xl bg-[#FAF5E8]/80 border border-[#EAE3CE] p-4">
              <summary className="text-sm font-bold text-[#2B3445] cursor-pointer select-none">
                Optional Game Instructions, Objective &amp; Controls
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div>
                  <label htmlFor="up-howto" className="block text-xs font-bold text-[#2B3445] mb-1">
                    How to Play
                  </label>
                  <textarea
                    id="up-howto"
                    rows={3}
                    value={howToPlay}
                    onChange={(e) => setHowToPlay(e.target.value)}
                    placeholder="Optional steps for playing this game..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>
                <div>
                  <label htmlFor="up-objective" className="block text-xs font-bold text-[#2B3445] mb-1">
                    Game Objective
                  </label>
                  <textarea
                    id="up-objective"
                    rows={3}
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="Optional goal or win condition..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>
                <div>
                  <label htmlFor="up-kb" className="block text-xs font-bold text-[#2B3445] mb-1">
                    Keyboard Controls
                  </label>
                  <textarea
                    id="up-kb"
                    rows={2}
                    value={keyboardControls}
                    onChange={(e) => setKeyboardControls(e.target.value)}
                    placeholder="Optional keyboard controls..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>
                <div>
                  <label htmlFor="up-mouse" className="block text-xs font-bold text-[#2B3445] mb-1">
                    Mouse Controls
                  </label>
                  <textarea
                    id="up-mouse"
                    rows={2}
                    value={mouseControls}
                    onChange={(e) => setMouseControls(e.target.value)}
                    placeholder="Optional mouse controls..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>
                <div>
                  <label htmlFor="up-touch" className="block text-xs font-bold text-[#2B3445] mb-1">
                    Mobile Touch Controls
                  </label>
                  <textarea
                    id="up-touch"
                    rows={2}
                    value={touchControls}
                    onChange={(e) => setTouchControls(e.target.value)}
                    placeholder="Optional mobile touch controls..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>
                <div>
                  <label htmlFor="up-tips" className="block text-xs font-bold text-[#2B3445] mb-1">
                    Useful Tips
                  </label>
                  <textarea
                    id="up-tips"
                    rows={2}
                    value={tips}
                    onChange={(e) => setTips(e.target.value)}
                    placeholder="Optional helpful tips..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>
              </div>
            </details>

            {uploadError && (
              <div
                role="alert"
                className="rounded-2xl bg-[#FAF5E8] border border-[#C8BCF2] p-3.5 text-xs sm:text-sm font-bold text-[#4B3D8F] flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#1D6B52]">
                  <span>{uploadProgress.label}</span>
                  <span className="tabular-nums">{uploadProgress.percent}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#FAF5E8] overflow-hidden">
                  <div
                    className="h-full bg-[#8AD8B5] transition-all duration-200"
                    style={{ width: `${uploadProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              {zipValidation?.valid && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handlePreviewLocalZip}
                  className="bubble-button inline-flex items-center gap-2 rounded-full bg-[#DDF0FC] hover:bg-[#CBE7FA] text-[#1E5B8A] px-5 py-2.5 text-sm font-bold cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>Preview Before Publishing</span>
                </button>
              )}

              <button
                type="button"
                disabled={uploading}
                onClick={resetUploadForm}
                className="bubble-button rounded-full bg-[#FAF5E8] hover:bg-[#EAE3CE] px-5 py-2.5 text-sm font-bold text-[#5A657A] cursor-pointer"
              >
                Reset
              </button>

              <button
                type="submit"
                disabled={uploading || !zipValidation?.valid}
                className="bubble-button rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] disabled:opacity-50 px-6 py-2.5 text-sm font-bold text-[#1D6B52] cursor-pointer"
              >
                {uploading ? 'Uploading Game...' : 'Upload Game'}
              </button>
            </div>
          </form>
        </div>
      )}

      {libraryError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FAF5E8] border border-[#C8BCF2] p-4 text-sm font-semibold text-[#4B3D8F] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{libraryError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadAdminLibrary()}
            className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-[#4B3D8F] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Uploaded Game Library */}
      <div className="rounded-[28px] bg-white border-2 border-[#CBE7FA] p-5 sm:p-7 bubble-shadow space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#2B3445]">
            Uploaded Game Library
          </h2>

          <div
            className="flex flex-wrap items-center gap-1 p-1 rounded-full bg-[#FAF5E8] border border-[#EAE3CE]"
            role="tablist"
            aria-label="Filter library by status"
          >
            {(['all', 'published', 'draft', 'unpublished'] as const).map((st) => {
              const active = libraryStatusFilter === st;
              const label =
                st === 'all'
                  ? 'All'
                  : st === 'published'
                    ? 'Published'
                    : st === 'draft'
                      ? 'Draft'
                      : 'Unpublished';
              return (
                <button
                  key={st}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setLibraryStatusFilter(st)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                    active
                      ? 'bg-white text-[#1D6B52] shadow-sm'
                      : 'text-[#5A657A] hover:text-[#2B3445]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {loadingGames ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-sm font-semibold text-[#5A657A]">
            <Loader2 className="w-6 h-6 animate-spin text-[#1E5B8A]" aria-hidden="true" />
            <span>Loading uploaded games...</span>
          </div>
        ) : filteredLibrary.length === 0 ? (
          <div className="rounded-[24px] bg-[#FAF5E8] p-8 text-center space-y-2">
            <FileArchive className="w-10 h-10 text-[#4B3D8F] mx-auto" aria-hidden="true" />
            <p className="font-display text-lg font-bold text-[#2B3445]">
              {games.length === 0
                ? 'No uploaded games in your library yet'
                : 'No games match this status filter'}
            </p>
            <p className="text-sm text-[#5A657A] max-w-md mx-auto">
              {games.length === 0
                ? 'Use the Upload New Game section above to validate and upload your first HTML5 game ZIP.'
                : 'Switch status tabs above to view your other uploaded games.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EAE3CE]">
            {filteredLibrary.map((g) => (
              <div
                key={g.id}
                className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-20 h-15 rounded-2xl bg-[#FAF5E8] overflow-hidden shrink-0 border border-[#EAE3CE]">
                    <GameThumbnail
                      src={g.thumbnailUrl}
                      alt={g.title}
                      title={g.title}
                      compact
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold text-[#2B3445] truncate">
                      {g.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#5A657A] mt-0.5">
                      {g.status === 'published' && (
                        <span className="inline-flex items-center gap-1 font-bold text-[#1D6B52]">
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Published</span>
                        </span>
                      )}
                      {g.status === 'draft' && (
                        <span className="inline-flex items-center gap-1 font-bold text-[#1E5B8A]">
                          <FilePenLine className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Draft</span>
                        </span>
                      )}
                      {g.status === 'unpublished' && (
                        <span className="inline-flex items-center gap-1 font-bold text-[#4B3D8F]">
                          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Unpublished</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPlayGame(g)}
                    className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] text-[#1D6B52] px-3.5 py-2 text-xs font-bold cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    <span>Preview</span>
                  </button>

                  {g.status !== 'published' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(g, 'published')}
                      className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#DDF0FC] hover:bg-[#CBE7FA] text-[#1E5B8A] px-3.5 py-2 text-xs font-bold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Publish</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(g, 'unpublished')}
                      className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#DDF0FC] hover:bg-[#CBE7FA] text-[#1E5B8A] px-3.5 py-2 text-xs font-bold cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Unpublish</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditModal(g)}
                    className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#EAE5FA] hover:bg-[#DFD7F8] text-[#4B3D8F] px-3.5 py-2 text-xs font-bold cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingGame(g)}
                    className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#FAF5E8] hover:bg-[#EAE3CE] text-[#2B3445] px-3.5 py-2 text-xs font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* Edit Game Modal */}
      {editingGame && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Game"
          className="fixed inset-0 z-50 bg-[#EDF6FC]/90 backdrop-blur-sm overflow-y-auto p-4 flex items-start sm:items-center justify-center"
        >
          <div className="w-full max-w-2xl rounded-[32px] bg-white border-2 border-[#EAE5FA] p-6 sm:p-8 bubble-shadow my-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl font-bold text-[#2B3445]">Edit Game</h2>
              <button
                type="button"
                onClick={() => setEditingGame(null)}
                aria-label="Close edit modal"
                className="w-9 h-9 rounded-full bg-[#FAF5E8] flex items-center justify-center text-[#2B3445] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label htmlFor="ed-title" className="block text-sm font-bold text-[#2B3445] mb-1">
                  Game Title
                </label>
                <input
                  id="ed-title"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-full bg-[#FFFDF6] border-2 border-[#CBE7FA] px-4 py-2.5 text-sm font-semibold"
                />
              </div>

              <div>
                <label htmlFor="ed-status" className="block text-sm font-bold text-[#2B3445] mb-1">
                  Status
                </label>
                <select
                  id="ed-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as GameStatus)}
                  className="w-full rounded-full bg-[#FFFDF6] border-2 border-[#CBE7FA] px-4 py-2.5 text-sm font-semibold"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="unpublished">Unpublished</option>
                </select>
              </div>

              <div>
                <label htmlFor="ed-thumb-file" className="block text-sm font-bold text-[#2B3445] mb-1">
                  Replace Thumbnail Image (optional)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="ed-thumb-file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    onChange={(e) => setEditThumbFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-[#5A657A] file:mr-3 file:rounded-full file:border-0 file:bg-[#EAE5FA] file:px-4 file:py-2 file:text-xs file:font-bold file:text-[#4B3D8F] cursor-pointer"
                  />
                  <div className="w-16 h-12 rounded-xl overflow-hidden border border-[#CBE7FA] bg-[#FAF5E8] shrink-0">
                    <GameThumbnail
                      src={editThumbPreviewUrl || editThumbUrl || editingGame.thumbnailUrl}
                      alt={`${editingGame.title} thumbnail preview`}
                      title={editTitle || editingGame.title}
                      compact
                    />
                  </div>
                </div>
                <input
                  id="ed-thumb"
                  type="url"
                  value={editThumbUrl}
                  onChange={(e) => setEditThumbUrl(e.target.value)}
                  placeholder="Or edit thumbnail URL"
                  aria-label="Thumbnail URL"
                  className="mt-2 w-full rounded-full bg-[#FFFDF6] border border-[#EAE3CE] px-4 py-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label htmlFor="ed-desc" className="block text-sm font-bold text-[#2B3445] mb-1">
                  Description
                </label>
                <textarea
                  id="ed-desc"
                  rows={5}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Write a detailed game overview for players..."
                  className="w-full rounded-2xl bg-[#FFFDF6] border-2 border-[#CBE7FA] px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label htmlFor="ed-howto" className="block text-xs font-bold text-[#2B3445] mb-1">
                    How to Play
                  </label>
                  <textarea
                    id="ed-howto"
                    rows={3}
                    value={editHowToPlay}
                    onChange={(e) => setEditHowToPlay(e.target.value)}
                    placeholder="Optional steps for playing..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border-2 border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>

                <div>
                  <label htmlFor="ed-objective" className="block text-xs font-bold text-[#2B3445] mb-1">
                    Game Objective
                  </label>
                  <textarea
                    id="ed-objective"
                    rows={3}
                    value={editObjective}
                    onChange={(e) => setEditObjective(e.target.value)}
                    placeholder="Optional objective or goal..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border-2 border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>

                <div>
                  <label htmlFor="ed-kb" className="block text-xs font-bold text-[#2B3445] mb-1">
                    Keyboard Controls
                  </label>
                  <textarea
                    id="ed-kb"
                    rows={2}
                    value={editKeyboardControls}
                    onChange={(e) => setEditKeyboardControls(e.target.value)}
                    placeholder="Optional keyboard controls..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border-2 border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>

                <div>
                  <label htmlFor="ed-mouse" className="block text-xs font-bold text-[#2B3445] mb-1">
                    Mouse Controls
                  </label>
                  <textarea
                    id="ed-mouse"
                    rows={2}
                    value={editMouseControls}
                    onChange={(e) => setEditMouseControls(e.target.value)}
                    placeholder="Optional mouse controls..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border-2 border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>

                <div>
                  <label htmlFor="ed-touch" className="block text-xs font-bold text-[#2B3445] mb-1">
                    Mobile Touch Controls
                  </label>
                  <textarea
                    id="ed-touch"
                    rows={2}
                    value={editTouchControls}
                    onChange={(e) => setEditTouchControls(e.target.value)}
                    placeholder="Optional mobile touch controls..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border-2 border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>

                <div>
                  <label htmlFor="ed-tips" className="block text-xs font-bold text-[#2B3445] mb-1">
                    Useful Tips
                  </label>
                  <textarea
                    id="ed-tips"
                    rows={2}
                    value={editTips}
                    onChange={(e) => setEditTips(e.target.value)}
                    placeholder="Optional helpful tips..."
                    className="w-full rounded-2xl bg-[#FFFDF6] border-2 border-[#CBE7FA] px-3.5 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#8AD8B5] resize-y"
                  />
                </div>
              </div>

              {editError && (
                <div className="rounded-2xl bg-[#FAF5E8] border border-[#C8BCF2] p-3 text-xs font-bold text-[#4B3D8F]">
                  {editError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingGame(null)}
                  className="bubble-button rounded-full bg-[#FAF5E8] px-5 py-2.5 text-sm font-bold text-[#5A657A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bubble-button rounded-full bg-[#DFD7F8] hover:bg-[#CFC4F5] px-6 py-2.5 text-sm font-bold text-[#4B3D8F] cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingGame && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Delete Game"
          className="fixed inset-0 z-50 bg-[#EDF6FC]/90 backdrop-blur-sm p-4 flex items-center justify-center"
        >
          <div className="w-full max-w-sm rounded-[28px] bg-white border-2 border-[#CBE7FA] p-6 text-center bubble-shadow space-y-4">
            <h2 className="font-display text-xl font-bold text-[#2B3445]">Delete Game?</h2>
            <p className="text-sm text-[#5A657A]">
              Are you sure you want to delete <strong>{deletingGame.title}</strong> and remove its uploaded game files? This cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                disabled={deletingBusy}
                onClick={() => setDeletingGame(null)}
                className="bubble-button rounded-full bg-[#FAF5E8] px-5 py-2.5 text-sm font-bold text-[#5A657A] cursor-pointer"
              >
                Keep Game
              </button>
              <button
                type="button"
                disabled={deletingBusy}
                onClick={handleConfirmDelete}
                className="bubble-button rounded-full bg-[#4B3D8F] text-[#FFFDF6] px-5 py-2.5 text-sm font-bold cursor-pointer"
              >
                {deletingBusy ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
