import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, Clock, Filter, Search, X, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';

const EVENT_TYPES = [
  { value: 'event', label: 'General Event', color: '#3b82f6', bg: 'bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60' },
  { value: 'exam', label: 'Exam', color: '#ef4444', bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'holiday', label: 'Holiday', color: '#22c55e', bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'sports', label: 'Sports', color: '#f97316', bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'academic', label: 'Academic', color: '#8b5cf6', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'extracurricular', label: 'Extracurricular', color: '#ec4899', bg: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' },
];

const getTypeInfo = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[0];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface SchoolEvent {
  id: number;
  title: string;
  description?: string;
  eventType: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  imageUrl?: string;
  isAllDay: boolean;
  isActive: boolean;
}

export default function SharedEventsPage() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<SchoolEvent | null>(null);

  const { data: events = [], isLoading } = useQuery<SchoolEvent[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/events');
      return res.json();
    },
  });

  const formatDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDateLong = (d: string) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const isPast = (d: string) => d < todayStr;
  const isUpcoming = (d: string) => {
    const diff = (new Date(d + 'T00:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  };

  const filtered = events.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.location || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.description || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || e.eventType === typeFilter;
    const matchMonth = monthFilter === 'all' || new Date(e.startDate + 'T00:00:00').getMonth() === parseInt(monthFilter);
    return matchSearch && matchType && matchMonth;
  });

  const upcoming = events.filter(e => e.startDate >= todayStr).sort((a,b) => a.startDate.localeCompare(b.startDate)).slice(0, 3);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">School Events</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Stay up-to-date with all school activities and events</p>
      </div>

      {/* Upcoming Banner */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">Coming Up Soon</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {upcoming.map(ev => {
              const ti = getTypeInfo(ev.eventType);
              return (
                <button key={ev.id} onClick={() => setSelectedEvent(ev)}
                  className="flex gap-3 p-3 rounded-lg bg-background border text-left hover:shadow-sm transition-shadow"
                  data-testid={`upcoming-event-${ev.id}`}>
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: ti.color }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(ev.startDate)}</p>
                    <Badge className={`text-xs mt-1 ${ti.bg}`} variant="secondary">{ti.label}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-events" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          )}
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-filter-month">
            <SelectValue placeholder="All months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44" data-testid="select-filter-type">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_,i) => <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No events found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(event => {
            const ti = getTypeInfo(event.eventType);
            const past = isPast(event.startDate);
            const soon = isUpcoming(event.startDate);
            return (
              <Card
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                data-testid={`card-event-${event.id}`}
                className={`overflow-hidden cursor-pointer hover:shadow-md transition-all ${past ? 'opacity-60' : ''}`}
              >
                {event.imageUrl ? (
                  <div className="h-36 overflow-hidden bg-muted">
                    <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-2" style={{ backgroundColor: ti.color }} />
                )}
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <h3 className="font-semibold text-foreground leading-snug flex-1 line-clamp-2">{event.title}</h3>
                    {soon && <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Soon</span>}
                    {past && <span className="text-xs text-muted-foreground flex-shrink-0">Past</span>}
                  </div>
                  <Badge className={`text-xs mb-3 ${ti.bg}`} variant="secondary">{ti.label}</Badge>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{formatDate(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ''}</span>
                    </div>
                    {!event.isAllDay && event.startTime && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}</span>
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                  {event.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={open => { if (!open) setSelectedEvent(null); }}>
        <DialogContent className="max-w-md">
          {selectedEvent && (() => {
            const ti = getTypeInfo(selectedEvent.eventType);
            return (
              <>
                <div className="h-1.5 -mx-6 -mt-6 mb-4 rounded-t-lg" style={{ backgroundColor: ti.color }} />
                <DialogHeader>
                  <div className="flex items-start justify-between gap-2">
                    <DialogTitle className="text-lg leading-snug pr-2">{selectedEvent.title}</DialogTitle>
                    <Badge className={`text-xs flex-shrink-0 ${ti.bg}`} variant="secondary">{ti.label}</Badge>
                  </div>
                </DialogHeader>
                {selectedEvent.imageUrl && (
                  <div className="rounded-lg overflow-hidden h-40 bg-muted">
                    <img src={selectedEvent.imageUrl} alt={selectedEvent.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span>{formatDateLong(selectedEvent.startDate)}{selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate ? ` – ${formatDateLong(selectedEvent.endDate)}` : ''}</span>
                  </div>
                  {!selectedEvent.isAllDay && selectedEvent.startTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{selectedEvent.startTime}{selectedEvent.endTime ? ` – ${selectedEvent.endTime}` : ''}</span>
                    </div>
                  )}
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}
                  {selectedEvent.description && (
                    <div className="pt-1 border-t">
                      <p className="text-sm text-muted-foreground leading-relaxed">{selectedEvent.description}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
