import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search, BookOpen, FileText, Video, Music, Image as ImageIcon,
  Download, Eye, X, ExternalLink, Filter, Clock, Star,
  ChevronRight, PlayCircle, Globe, Paperclip,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
type Resource = {
  id: number;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string | null;
  fileSize: number | null;
  resourceType: string;
  subjectId: number | null;
  classId: number | null;
  downloadCount: number;
  createdAt: string;
  // joined
  subjectName?: string | null;
};

type Subject = { id: number; name: string };

// ── Helpers ────────────────────────────────────────────────────────────────
const RESOURCE_TYPE_CFG: Record<string, { label: string; icon: React.ReactNode; gradient: string; badge: string }> = {
  pdf:        { label: 'PDF',        icon: <FileText className="h-5 w-5"  />, gradient: 'from-red-500 to-rose-600',     badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'   },
  video:      { label: 'Video',      icon: <Video className="h-5 w-5"     />, gradient: 'from-blue-500 to-cyan-600',    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  audio:      { label: 'Audio',      icon: <Music className="h-5 w-5"     />, gradient: 'from-purple-500 to-violet-600',badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
  image:      { label: 'Image',      icon: <ImageIcon className="h-5 w-5" />, gradient: 'from-emerald-500 to-teal-600', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  past_paper: { label: 'Past Paper', icon: <FileText className="h-5 w-5" />, gradient: 'from-orange-500 to-amber-600', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  study_guide:{ label: 'Study Guide',icon: <BookOpen className="h-5 w-5" />, gradient: 'from-green-500 to-emerald-600',badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  notes:      { label: 'Notes',      icon: <FileText className="h-5 w-5" />, gradient: 'from-slate-500 to-gray-600',   badge: 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400' },
  link:       { label: 'Link',       icon: <Globe className="h-5 w-5"     />, gradient: 'from-indigo-500 to-blue-600',  badge: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' },
};

function getTypeCfg(r: Resource) {
  const t = (r.fileType || r.resourceType || '').toLowerCase();
  return RESOURCE_TYPE_CFG[t] || RESOURCE_TYPE_CFG['notes'];
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isViewable(r: Resource): boolean {
  const t = (r.fileType || r.resourceType || '').toLowerCase();
  return ['pdf', 'video', 'audio', 'image', 'link'].includes(t);
}

function isVideo(r: Resource): boolean {
  return (r.fileType || r.resourceType || '').toLowerCase() === 'video';
}

function isAudio(r: Resource): boolean {
  return (r.fileType || r.resourceType || '').toLowerCase() === 'audio';
}

function isImage(r: Resource): boolean {
  return (r.fileType || r.resourceType || '').toLowerCase() === 'image';
}

function isPdf(r: Resource): boolean {
  const t = (r.fileType || r.resourceType || '').toLowerCase();
  return t === 'pdf' || t === 'past_paper' || r.fileUrl?.endsWith('.pdf');
}

const RECENTLY_VIEWED_KEY = 'library_recently_viewed';
function getRecentlyViewed(): number[] {
  try { return JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]'); } catch { return []; }
}
function addRecentlyViewed(id: number) {
  const prev = getRecentlyViewed().filter(x => x !== id);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify([id, ...prev].slice(0, 8)));
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function StudentLibrary() {
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<Resource | null>(null);
  const [recentIds, setRecentIds] = useState<number[]>(() => getRecentlyViewed());

  const { data: resources = [], isLoading } = useQuery<Resource[]>({
    queryKey: ['/api/study-resources'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/study-resources');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/subjects');
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  // Build subject lookup
  const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
  const enriched: Resource[] = resources.map(r => ({ ...r, subjectName: r.subjectId ? subjectMap.get(r.subjectId) ?? null : null }));

  // Filters
  const filtered = enriched.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q) || (r.subjectName || '').toLowerCase().includes(q);
    const matchSubject = subjectFilter === 'all' || String(r.subjectId) === subjectFilter;
    const matchType = typeFilter === 'all' || (r.fileType || r.resourceType || '').toLowerCase() === typeFilter;
    return matchSearch && matchSubject && matchType;
  });

  // Sections
  const recentResources = recentIds.map(id => enriched.find(r => r.id === id)).filter(Boolean) as Resource[];
  const recommended = selected
    ? enriched.filter(r => r.id !== selected.id && r.subjectId === selected.subjectId).slice(0, 4)
    : enriched.slice(0, 4);

  const openResource = useCallback((r: Resource) => {
    setSelected(r);
    addRecentlyViewed(r.id);
    setRecentIds(getRecentlyViewed());
  }, []);

  const typeOptions = ['all', ...Array.from(new Set(enriched.map(r => (r.fileType || r.resourceType || 'other').toLowerCase())))];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white p-5 sm:p-6 shadow-xl shadow-emerald-500/20">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Library</h1>
            <p className="text-emerald-200 text-sm mt-0.5">Study resources, past papers, videos & more</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-3xl font-bold">{enriched.length}</p>
            <p className="text-emerald-200 text-xs">resources</p>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search resources…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
            data-testid="input-library-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            data-testid="select-subject-filter"
            className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            data-testid="select-type-filter"
            className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {typeOptions.map(t => (
              <option key={t} value={t}>
                {t === 'all' ? 'All Types' : (RESOURCE_TYPE_CFG[t]?.label ?? t.replace('_', ' '))}
              </option>
            ))}
          </select>
          {(search || subjectFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setSubjectFilter('all'); setTypeFilter('all'); }}
              className="h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
              data-testid="button-clear-filters"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Recently Viewed */}
      {recentResources.length > 0 && !search && subjectFilter === 'all' && typeFilter === 'all' && (
        <Section title="Recently Viewed" icon={<Clock className="h-4 w-4" />}>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {recentResources.slice(0, 5).map(r => (
              <MiniCard key={r.id} r={r} onClick={() => openResource(r)} />
            ))}
          </div>
        </Section>
      )}

      {/* Resource Grid */}
      {isLoading ? (
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!(search || subjectFilter !== 'all' || typeFilter !== 'all')} onClear={() => { setSearch(''); setSubjectFilter('all'); setTypeFilter('all'); }} />
      ) : (
        <Section title={`All Resources`} icon={<BookOpen className="h-4 w-4" />} count={filtered.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => (
              <ResourceCard key={r.id} r={r} onClick={() => openResource(r)} />
            ))}
          </div>
        </Section>
      )}

      {/* Resource Viewer Dialog */}
      {selected && (
        <ResourceViewerDialog
          resource={selected}
          recommended={recommended}
          onClose={() => setSelected(null)}
          onOpen={openResource}
        />
      )}
    </div>
  );
}

// ── Resource Card ──────────────────────────────────────────────────────────
function ResourceCard({ r, onClick }: { r: Resource; onClick: () => void }) {
  const cfg = getTypeCfg(r);

  return (
    <div
      data-testid={`card-resource-${r.id}`}
      onClick={onClick}
      className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-600 flex flex-col"
    >
      {/* Icon header */}
      <div className={`h-14 bg-gradient-to-r ${cfg.gradient} flex items-center px-4 gap-3`}>
        <div className="text-white">{cfg.icon}</div>
        <span className="text-white text-xs font-bold uppercase tracking-wider">{cfg.label}</span>
        {r.fileSize && <span className="ml-auto text-white/70 text-xs">{formatSize(r.fileSize)}</span>}
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight line-clamp-2" data-testid={`text-resource-title-${r.id}`}>
          {r.title}
        </h3>

        {r.subjectName && (
          <Badge className={`text-xs w-fit ${cfg.badge} border-0`}>{r.subjectName}</Badge>
        )}

        {r.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 flex-1">{r.description}</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
          <div className="flex items-center gap-1.5">
            {isViewable(r) ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <Eye className="h-3.5 w-3.5" /> View
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                <Download className="h-3.5 w-3.5" /> Download
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mini Card (recently viewed) ────────────────────────────────────────────
function MiniCard({ r, onClick }: { r: Resource; onClick: () => void }) {
  const cfg = getTypeCfg(r);
  return (
    <div
      onClick={onClick}
      className="flex-shrink-0 w-36 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-md transition-all"
      data-testid={`mini-card-${r.id}`}
    >
      <div className={`h-8 bg-gradient-to-r ${cfg.gradient} flex items-center px-2 gap-1.5`}>
        <span className="text-white scale-75">{cfg.icon}</span>
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">{r.title}</p>
      </div>
    </div>
  );
}

// ── Resource Viewer Dialog ─────────────────────────────────────────────────
function ResourceViewerDialog({ resource, recommended, onClose, onOpen }: {
  resource: Resource;
  recommended: Resource[];
  onClose: () => void;
  onOpen: (r: Resource) => void;
}) {
  const cfg = getTypeCfg(resource);

  const handleDownload = () => {
    window.open(resource.fileUrl, '_blank');
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-0" data-testid="dialog-resource-viewer">
        {/* Gradient header */}
        <div className={`h-2 w-full rounded-t-2xl bg-gradient-to-r ${cfg.gradient}`} />

        <div className="p-5 sm:p-6 space-y-5">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white flex-shrink-0`}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug" data-testid="text-viewer-title">
                  {resource.title}
                </DialogTitle>
                {resource.subjectName && (
                  <Badge className={`text-xs mt-1 ${cfg.badge} border-0`}>{resource.subjectName}</Badge>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={handleDownload} className="rounded-xl" data-testid="button-download">
                  <Download className="h-4 w-4 mr-1.5" />
                  {isViewable(resource) ? 'Download' : 'Open'}
                </Button>
                <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost" className="rounded-xl" data-testid="button-open-external">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </DialogHeader>

          {/* Content Viewer */}
          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {isPdf(resource) ? (
              <iframe
                src={`${resource.fileUrl}#view=FitH`}
                className="w-full h-[50vh] min-h-[300px]"
                title={resource.title}
                data-testid="viewer-pdf"
              />
            ) : isVideo(resource) ? (
              <video
                src={resource.fileUrl}
                controls
                className="w-full max-h-[50vh] bg-black"
                data-testid="viewer-video"
              >
                Your browser does not support the video tag.
              </video>
            ) : isAudio(resource) ? (
              <div className="p-8 flex flex-col items-center gap-4">
                <div className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center`}>
                  <PlayCircle className="h-10 w-10 text-white" />
                </div>
                <audio src={resource.fileUrl} controls className="w-full" data-testid="viewer-audio">
                  Your browser does not support the audio tag.
                </audio>
              </div>
            ) : isImage(resource) ? (
              <img
                src={resource.fileUrl}
                alt={resource.title}
                className="w-full max-h-[50vh] object-contain"
                data-testid="viewer-image"
              />
            ) : (
              <div className="p-10 flex flex-col items-center gap-4 text-center">
                <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white`}>
                  {cfg.icon}
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Preview not available for this file type.</p>
                <Button onClick={handleDownload} className="rounded-xl" data-testid="button-download-fallback">
                  <Download className="h-4 w-4 mr-2" /> Download to View
                </Button>
              </div>
            )}
          </div>

          {/* Description */}
          {resource.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed" data-testid="text-viewer-description">
                {resource.description}
              </p>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
              <p className="text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Uploaded</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{formatDate(resource.createdAt)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
              <p className="text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Downloads</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{resource.downloadCount}</p>
            </div>
            {resource.fileSize && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                <p className="text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Size</p>
                <p className="text-gray-900 dark:text-gray-100 font-medium">{formatSize(resource.fileSize)}</p>
              </div>
            )}
          </div>

          {/* Related Resources */}
          {recommended.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" /> Related Resources
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {recommended.map(r => {
                  const rcfg = getTypeCfg(r);
                  return (
                    <button
                      key={r.id}
                      onClick={() => onOpen(r)}
                      data-testid={`button-related-${r.id}`}
                      className="text-left flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors"
                    >
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${rcfg.gradient} flex items-center justify-center text-white flex-shrink-0 scale-90`}>
                        {rcfg.icon}
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-2 flex-1">{r.title}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Reusable section wrapper ───────────────────────────────────────────────
function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count?: number; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        {count !== undefined && (
          <Badge variant="outline" className="ml-auto text-xs">{count}</Badge>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="empty-state-library">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
        <BookOpen className="h-8 w-8 text-emerald-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {hasFilters ? 'No matching resources' : 'No resources yet'}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-4">
        {hasFilters ? 'Try adjusting your search or filters.' : 'Your teachers haven\'t uploaded any resources yet. Check back later.'}
      </p>
      {hasFilters && (
        <Button variant="outline" className="rounded-xl" onClick={onClear}>Clear Filters</Button>
      )}
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────
function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Skeleton className="h-14 w-full rounded-none" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
