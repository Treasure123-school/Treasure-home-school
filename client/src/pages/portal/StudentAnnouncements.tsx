import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Calendar, Search, User, ChevronDown, ChevronUp, Bell, AlertTriangle, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Priority = 'urgent' | 'important' | 'normal';
type FilterType = 'all' | Priority;

const PRIORITY_CONFIG: Record<Priority, { label: string; badgeClass: string; iconClass: string; icon: React.ElementType }> = {
  urgent: {
    label: 'Urgent',
    badgeClass: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',
    iconClass: 'text-red-500',
    icon: AlertTriangle,
  },
  important: {
    label: 'Important',
    badgeClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    iconClass: 'text-amber-500',
    icon: Bell,
  },
  normal: {
    label: 'General',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    iconClass: 'text-slate-400',
    icon: Info,
  },
};

export default function StudentAnnouncements() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  if (!user) {
    return <div className="p-6 text-center text-muted-foreground">Please log in to view announcements.</div>;
  }

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements', 'Student'],
    queryFn: async () => {
      const response = await fetch('/api/announcements?role=Student', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch announcements');
      return response.json();
    }
  });

  const formattedAnnouncements = (announcements ?? []).map((a: any) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    publishedAt: new Date(a.createdAt || a.publishedAt),
    author: a.authorName || a.author || 'School Administration',
    priority: (a.priority || 'normal') as Priority,
    category: a.category || '',
  }));

  const filtered = formattedAnnouncements.filter((a: any) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = filter === 'all' || a.priority === filter;
    return matchesSearch && matchesPriority;
  });

  const counts = {
    all: formattedAnnouncements.length,
    urgent: formattedAnnouncements.filter((a: any) => a.priority === 'urgent').length,
    important: formattedAnnouncements.filter((a: any) => a.priority === 'important').length,
    normal: formattedAnnouncements.filter((a: any) => a.priority === 'normal').length,
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const CHAR_LIMIT = 280;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-indigo-700 p-6 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white" />
          <div className="absolute -bottom-12 -left-6 w-36 h-36 rounded-full bg-white" />
        </div>
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="h-5 w-5 text-white/70" />
              <span className="text-white/70 text-sm font-medium uppercase tracking-widest">School Board</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">Announcements</h1>
            <p className="text-white/70 text-sm">Stay informed with the latest school news and updates</p>
          </div>
          <div className="flex-shrink-0 hidden sm:flex flex-col items-end gap-1">
            <div className="text-4xl font-black">{counts.all}</div>
            <div className="text-white/70 text-xs font-medium">total posts</div>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search announcements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white dark:bg-gray-900 rounded-xl border-gray-200 dark:border-gray-700"
            data-testid="input-search-announcements"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <TabsList className="w-full">
            {(['all', 'urgent', 'important', 'normal'] as FilterType[]).map((f) => (
              <TabsTrigger key={f} value={f} className="flex-1 text-xs sm:text-sm" data-testid={`filter-${f}`}>
                {f === 'all' ? 'All' : PRIORITY_CONFIG[f].label} ({counts[f === 'all' ? 'all' : f]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Results count */}
      {!isLoading && (
        <div className="flex items-center text-sm text-muted-foreground">
          <span>Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{filtered.length}</span> announcement{filtered.length !== 1 ? 's' : ''}</span>
          {searchTerm && (
            <span className="ml-1"> matching "<span className="font-medium">{searchTerm}</span>"</span>
          )}
        </div>
      )}

      {/* Announcement cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex gap-4 mb-3">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-32" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center">
          <div className="w-16 h-16 bg-primary/5 dark:bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Megaphone className="h-8 w-8 text-primary/70" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {searchTerm ? 'No matching announcements' : 'No announcements yet'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
            {searchTerm
              ? `Try a different search term or clear your filter.`
              : 'School announcements from teachers and administration will appear here.'}
          </p>
          {searchTerm && (
            <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setFilter('all'); }}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((announcement: any) => {
            const config = PRIORITY_CONFIG[announcement.priority as Priority] || PRIORITY_CONFIG.normal;
            const PriorityIcon = config.icon;
            const isExpanded = expandedIds.has(announcement.id);
            const isLong = announcement.content.length > CHAR_LIMIT;
            const displayContent = isLong && !isExpanded
              ? announcement.content.slice(0, CHAR_LIMIT) + '…'
              : announcement.content;

            return (
              <div
                key={announcement.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                data-testid={`card-announcement-${announcement.id}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base leading-snug flex-1">
                      {announcement.title}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <PriorityIcon className={`h-3.5 w-3.5 ${config.iconClass}`} />
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${config.badgeClass}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span data-testid={`text-announcement-date-${announcement.id}`}>{formatDate(announcement.publishedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      <span data-testid={`text-announcement-author-${announcement.id}`}>{announcement.author}</span>
                    </div>
                    {announcement.category && (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-[11px] font-medium capitalize">
                        {announcement.category}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" data-testid={`text-announcement-content-${announcement.id}`}>
                    {displayContent}
                  </p>

                  {isLong && (
                    <button
                      onClick={() => toggleExpand(announcement.id)}
                      className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary dark:text-primary/70 hover:text-primary dark:hover:text-primary/60 transition-colors"
                      data-testid={`button-expand-${announcement.id}`}
                    >
                      {isExpanded ? (
                        <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                      ) : (
                        <><ChevronDown className="h-3.5 w-3.5" /> Read more</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
