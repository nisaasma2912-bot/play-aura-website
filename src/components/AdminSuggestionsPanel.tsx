import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Eye,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  blockSuggestionVisitorAdmin,
  deleteSuggestionAdmin,
  fetchAllSuggestionsAdmin,
  fetchBlockedSuggestionVisitorsAdmin,
  isSupabaseConfigured,
  unblockSuggestionVisitorAdmin,
  updateSuggestionStatusAdmin,
} from '../lib/supabase';
import type {
  AdminUserSession,
  BlockedSuggestionVisitorRecord,
  GameSuggestionRecord,
  SuggestionStatus,
} from '../types/game';

interface AdminSuggestionsPanelProps {
  session: AdminUserSession;
  onNewCountChange?: (newCount: number) => void;
}

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  archived: 'Archived',
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function AdminSuggestionsPanel({
  session,
  onNewCountChange,
}: AdminSuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<GameSuggestionRecord[]>([]);
  const [blockedVisitors, setBlockedVisitors] = useState<BlockedSuggestionVisitorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<'suggestions' | 'blocked'>('suggestions');
  const [statusFilter, setStatusFilter] = useState<'all' | SuggestionStatus>('all');
  const [searchText, setSearchText] = useState('');

  const [viewingSuggestion, setViewingSuggestion] = useState<GameSuggestionRecord | null>(null);
  const [deletingSuggestion, setDeletingSuggestion] = useState<GameSuggestionRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const [suggestionRows, blockedRows] = await Promise.all([
        fetchAllSuggestionsAdmin(),
        fetchBlockedSuggestionVisitorsAdmin(),
      ]);
      setSuggestions(suggestionRows);
      setBlockedVisitors(blockedRows);
      onNewCountChange?.(suggestionRows.filter((s) => s.status === 'new').length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load suggestions right now.');
    } finally {
      setLoading(false);
    }
  }, [onNewCountChange]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    onNewCountChange?.(suggestions.filter((s) => s.status === 'new').length);
  }, [suggestions, onNewCountChange]);

  const blockedHashSet = useMemo(
    () => new Set(blockedVisitors.map((b) => b.visitorTokenHash)),
    [blockedVisitors]
  );

  const filteredSuggestions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return suggestions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.message.toLowerCase().includes(q) ||
        s.visitorTokenHash.toLowerCase().includes(q)
      );
    });
  }, [suggestions, statusFilter, searchText]);

  const newSuggestionsCount = useMemo(
    () => suggestions.filter((s) => s.status === 'new').length,
    [suggestions]
  );

  const handleStatusUpdate = async (item: GameSuggestionRecord, nextStatus: SuggestionStatus) => {
    setBusyId(item.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateSuggestionStatusAdmin(item.id, nextStatus);
      setSuggestions((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      if (viewingSuggestion?.id === updated.id) {
        setViewingSuggestion(updated);
      }
      setNotice(`Marked suggestion as ${STATUS_LABEL[nextStatus]}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update suggestion status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSuggestion) return;
    setBusyId(deletingSuggestion.id);
    setError(null);
    setNotice(null);
    try {
      await deleteSuggestionAdmin(deletingSuggestion.id);
      setSuggestions((prev) => prev.filter((row) => row.id !== deletingSuggestion.id));
      if (viewingSuggestion?.id === deletingSuggestion.id) {
        setViewingSuggestion(null);
      }
      setDeletingSuggestion(null);
      setNotice('Deleted suggestion.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete suggestion.');
    } finally {
      setBusyId(null);
    }
  };

  const handleBlockVisitor = async (visitorTokenHash: string) => {
    setBusyId(visitorTokenHash);
    setError(null);
    setNotice(null);
    try {
      const blocked = await blockSuggestionVisitorAdmin(
        visitorTokenHash,
        session.userId,
        'Blocked from Admin Suggestions moderation'
      );
      setBlockedVisitors((prev) => {
        const filtered = prev.filter((b) => b.visitorTokenHash !== blocked.visitorTokenHash);
        return [blocked, ...filtered];
      });
      setNotice(`Blocked anonymous visitor #${visitorTokenHash.slice(0, 8)} from future suggestions.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block visitor.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnblockVisitor = async (visitorTokenHash: string) => {
    setBusyId(visitorTokenHash);
    setError(null);
    setNotice(null);
    try {
      await unblockSuggestionVisitorAdmin(visitorTokenHash);
      setBlockedVisitors((prev) =>
        prev.filter((b) => b.visitorTokenHash !== visitorTokenHash)
      );
      setNotice(`Unblocked anonymous visitor #${visitorTokenHash.slice(0, 8)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unblock visitor.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real Suggestion Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[24px] bg-[#FAF5E8] border border-[#EAE3CE] p-5">
          <div className="text-xs font-bold text-[#5A657A]">Total Suggestions</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {suggestions.length}
          </div>
        </div>
        <div className="rounded-[24px] bg-[#D8F3E5]/60 border border-[#BFEAD6] p-5">
          <div className="text-xs font-bold text-[#1D6B52]">New Suggestions</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {newSuggestionsCount}
          </div>
        </div>
        <div className="rounded-[24px] bg-[#EAE5FA]/65 border border-[#DFD7F8] p-5">
          <div className="text-xs font-bold text-[#4B3D8F]">Blocked Visitors</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {blockedVisitors.length}
          </div>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-2xl bg-[#D8F3E5]/70 border border-[#8AD8B5] px-4 py-3 text-sm font-bold text-[#1D6B52] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
            className="p-1 rounded-full hover:bg-white/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FAF5E8] border border-[#C8BCF2] p-4 text-sm font-semibold text-[#4B3D8F] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-[#4B3D8F] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Suggestions & Block Management Card */}
      <div className="rounded-[28px] bg-white border-2 border-[#CBE7FA] p-5 sm:p-7 bubble-shadow space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSubTab('suggestions')}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                subTab === 'suggestions'
                  ? 'bg-[#D8F3E5] text-[#1D6B52]'
                  : 'bg-[#FAF5E8] text-[#5A657A] hover:text-[#2B3445]'
              }`}
            >
              Suggestions ({suggestions.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('blocked')}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                subTab === 'blocked'
                  ? 'bg-[#EAE5FA] text-[#4B3D8F]'
                  : 'bg-[#FAF5E8] text-[#5A657A] hover:text-[#2B3445]'
              }`}
            >
              Blocked Visitors ({blockedVisitors.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="bubble-button inline-flex items-center justify-center gap-1.5 rounded-full bg-[#FAF5E8] hover:bg-[#DDF0FC] text-[#1E5B8A] px-4 py-2 text-xs font-bold cursor-pointer self-start lg:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>

        {subTab === 'suggestions' ? (
          <>
            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div
                className="flex flex-wrap items-center gap-1 p-1 rounded-full bg-[#FAF5E8] border border-[#EAE3CE]"
                role="tablist"
                aria-label="Filter suggestions by status"
              >
                {(['all', 'new', 'reviewed', 'archived'] as const).map((st) => {
                  const active = statusFilter === st;
                  const label = st === 'all' ? 'All' : STATUS_LABEL[st];
                  return (
                    <button
                      key={st}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStatusFilter(st)}
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

              <div className="relative w-full md:w-72">
                <Search
                  className="w-4 h-4 text-[#5A657A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search suggestion text..."
                  aria-label="Filter suggestions by message text"
                  className="w-full rounded-full bg-[#FFFDF6] border-2 border-[#CBE7FA] pl-10 pr-4 py-2 text-xs sm:text-sm font-semibold text-[#2B3445] focus:outline-none focus:border-[#8AD8B5]"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-sm font-semibold text-[#5A657A]">
                <Loader2 className="w-6 h-6 animate-spin text-[#1E5B8A]" aria-hidden="true" />
                <span>Loading game suggestions...</span>
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="rounded-[24px] bg-[#FAF5E8] p-8 text-center space-y-2">
                <MessageSquareText className="w-10 h-10 text-[#1E5B8A] mx-auto" aria-hidden="true" />
                <p className="font-display text-lg font-bold text-[#2B3445]">
                  {suggestions.length === 0
                    ? 'No game suggestions yet'
                    : 'No suggestions match your filter'}
                </p>
                <p className="text-sm text-[#5A657A] max-w-md mx-auto">
                  {suggestions.length === 0
                    ? 'When visitors submit game ideas from the homepage Suggestion button, they will appear here.'
                    : 'Try clearing the search box or switching status filters above.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EAE3CE]">
                {filteredSuggestions.map((item) => {
                  const isBlocked = blockedHashSet.has(item.visitorTokenHash);
                  const rowBusy = busyId === item.id || busyId === item.visitorTokenHash;

                  return (
                    <div
                      key={item.id}
                      className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm sm:text-base font-bold text-[#2B3445] line-clamp-2 break-words">
                          {item.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#5A657A]">
                          <span
                            className={
                              item.status === 'new'
                                ? 'font-bold text-[#1D6B52]'
                                : item.status === 'reviewed'
                                  ? 'font-bold text-[#1E5B8A]'
                                  : 'font-bold text-[#4B3D8F]'
                            }
                          >
                            {STATUS_LABEL[item.status]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatTimestamp(item.createdAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            Visitor #{item.visitorTokenHash.slice(0, 8)}
                          </span>
                          {isBlocked && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-bold text-[#4B3D8F]">Blocked</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewingSuggestion(item)}
                          className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#DDF0FC] hover:bg-[#CBE7FA] text-[#1E5B8A] px-3.5 py-2 text-xs font-bold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>View</span>
                        </button>

                        {isBlocked ? (
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => void handleUnblockVisitor(item.visitorTokenHash)}
                            className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] disabled:opacity-50 text-[#1D6B52] px-3.5 py-2 text-xs font-bold cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Unblock Visitor</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => void handleBlockVisitor(item.visitorTokenHash)}
                            className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#EAE5FA] hover:bg-[#DFD7F8] disabled:opacity-50 text-[#4B3D8F] px-3.5 py-2 text-xs font-bold cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Block Visitor</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={rowBusy}
                          onClick={() => setDeletingSuggestion(item)}
                          className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#FAF5E8] hover:bg-[#EAE3CE] disabled:opacity-50 text-[#2B3445] px-3.5 py-2 text-xs font-bold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : loading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-sm font-semibold text-[#5A657A]">
            <Loader2 className="w-6 h-6 animate-spin text-[#1E5B8A]" aria-hidden="true" />
            <span>Loading blocked visitors...</span>
          </div>
        ) : blockedVisitors.length === 0 ? (
          <div className="rounded-[24px] bg-[#FAF5E8] p-8 text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-[#1D6B52] mx-auto" aria-hidden="true" />
            <p className="font-display text-lg font-bold text-[#2B3445]">
              No blocked visitors
            </p>
            <p className="text-sm text-[#5A657A] max-w-md mx-auto">
              Anonymous visitor hashes you block from suggestions will appear here and can be unblocked at any time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EAE3CE]">
            {blockedVisitors.map((visitor) => (
              <div
                key={visitor.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-xs sm:text-sm font-bold text-[#2B3445] break-all">
                    {visitor.visitorTokenHash}
                  </p>
                  <p className="text-xs font-semibold text-[#5A657A]">
                    Blocked {formatTimestamp(visitor.createdAt)}
                    {visitor.reason ? ` · ${visitor.reason}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busyId === visitor.visitorTokenHash}
                  onClick={() => void handleUnblockVisitor(visitor.visitorTokenHash)}
                  className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] disabled:opacity-50 text-[#1D6B52] px-4 py-2 text-xs font-bold cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Unblock</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Full Suggestion Modal */}
      {viewingSuggestion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="View Game Suggestion"
          className="fixed inset-0 z-50 bg-[#EDF6FC]/90 backdrop-blur-sm overflow-y-auto p-4 flex items-center justify-center"
        >
          <div className="w-full max-w-lg rounded-[32px] bg-white border-2 border-[#CBE7FA] p-6 sm:p-8 bubble-shadow my-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-[#2B3445]">
                Game Suggestion Details
              </h2>
              <button
                type="button"
                onClick={() => setViewingSuggestion(null)}
                aria-label="Close suggestion details"
                className="w-9 h-9 rounded-full bg-[#FAF5E8] flex items-center justify-center text-[#2B3445] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#FFFDF6] border border-[#EAE3CE] p-4 text-sm sm:text-base font-semibold text-[#2B3445] whitespace-pre-wrap break-words leading-relaxed">
              {viewingSuggestion.message}
            </div>

            <div className="space-y-1 text-xs font-semibold text-[#5A657A]">
              <p>Submitted: {formatTimestamp(viewingSuggestion.createdAt)}</p>
              <p className="font-mono break-all">
                Visitor Hash: {viewingSuggestion.visitorTokenHash}
              </p>
            </div>

            <div>
              <label
                htmlFor="suggestion-status-select"
                className="block text-sm font-bold text-[#2B3445] mb-1.5"
              >
                Moderation Status
              </label>
              <select
                id="suggestion-status-select"
                value={viewingSuggestion.status}
                disabled={busyId === viewingSuggestion.id}
                onChange={(e) =>
                  void handleStatusUpdate(
                    viewingSuggestion,
                    e.target.value as SuggestionStatus
                  )
                }
                className="w-full rounded-full bg-[#FFFDF6] border-2 border-[#CBE7FA] px-4 py-2.5 text-sm font-semibold text-[#2B3445]"
              >
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {blockedHashSet.has(viewingSuggestion.visitorTokenHash) ? (
                <button
                  type="button"
                  disabled={busyId === viewingSuggestion.visitorTokenHash}
                  onClick={() =>
                    void handleUnblockVisitor(viewingSuggestion.visitorTokenHash)
                  }
                  className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] text-[#1D6B52] px-4 py-2.5 text-xs font-bold cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Unblock Visitor</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyId === viewingSuggestion.visitorTokenHash}
                  onClick={() =>
                    void handleBlockVisitor(viewingSuggestion.visitorTokenHash)
                  }
                  className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#EAE5FA] hover:bg-[#DFD7F8] text-[#4B3D8F] px-4 py-2.5 text-xs font-bold cursor-pointer"
                >
                  <Ban className="w-4 h-4" aria-hidden="true" />
                  <span>Block Visitor</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingSuggestion(viewingSuggestion)}
                  className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#FAF5E8] hover:bg-[#EAE3CE] text-[#2B3445] px-4 py-2.5 text-xs font-bold cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSuggestion(null)}
                  className="bubble-button rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] text-[#1D6B52] px-5 py-2.5 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSuggestion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Delete Suggestion"
          className="fixed inset-0 z-50 bg-[#EDF6FC]/90 backdrop-blur-sm p-4 flex items-center justify-center"
        >
          <div className="w-full max-w-sm rounded-[28px] bg-white border-2 border-[#CBE7FA] p-6 text-center bubble-shadow space-y-4">
            <h2 className="font-display text-xl font-bold text-[#2B3445]">
              Delete Suggestion?
            </h2>
            <p className="text-sm text-[#5A657A]">
              Are you sure you want to permanently remove this suggestion? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                disabled={busyId === deletingSuggestion.id}
                onClick={() => setDeletingSuggestion(null)}
                className="bubble-button rounded-full bg-[#FAF5E8] px-5 py-2.5 text-sm font-bold text-[#5A657A] cursor-pointer"
              >
                Keep
              </button>
              <button
                type="button"
                disabled={busyId === deletingSuggestion.id}
                onClick={() => void handleConfirmDelete()}
                className="bubble-button rounded-full bg-[#4B3D8F] text-[#FFFDF6] px-5 py-2.5 text-sm font-bold cursor-pointer"
              >
                {busyId === deletingSuggestion.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
