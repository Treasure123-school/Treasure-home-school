import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Filter, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';

const EVENT_TYPES = [
  { value: 'exam', label: 'Exam', color: '#ef4444', light: '#fee2e2', bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'holiday', label: 'Holiday', color: '#22c55e', light: '#dcfce7', bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'event', label: 'Event', color: '#3b82f6', light: '#dbeafe', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'sports', label: 'Sports', color: '#f97316', light: '#ffedd5', bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'academic', label: 'Academic', color: '#8b5cf6', light: '#ede9fe', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'extracurricular', label: 'Extracurricular', color: '#ec4899', light: '#fce7f3', bg: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' },
];

const getTypeInfo = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[2];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
  color?: string;
  isAllDay: boolean;
  isActive: boolean;
}

interface Props {
  isAdmin?: boolean;
}

export default function SchoolCalendar({ isAdmin = false }: Props) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<SchoolEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<SchoolEvent[]>([]);
  const [dayDialogDate, setDayDialogDate] = useState<string | null>(null);

  const apiEndpoint = isAdmin ? '/api/admin/events' : '/api/events';

  const { data: events = [], isLoading } = useQuery<SchoolEvent[]>({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      const res = await apiRequest('GET', apiEndpoint);
      return res.json();
    },
  });

  const filteredEvents = useMemo(() =>
    events.filter(e => typeFilter === 'all' || e.eventType === typeFilter),
    [events, typeFilter]
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const getDaysInMonth = () => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const days: Array<{ date: number; month: 'prev' | 'current' | 'next'; fullDate: string }> = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month - 1 < 0 ? 11 : month - 1;
      const y = month - 1 < 0 ? year - 1 : year;
      days.push({ date: d, month: 'prev', fullDate: `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: d, month: 'current', fullDate: `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month + 1 > 11 ? 0 : month + 1;
      const y = month + 1 > 11 ? year + 1 : year;
      days.push({ date: d, month: 'next', fullDate: `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` });
    }
    return days;
  };

  const getEventsForDate = (dateStr: string) => {
    return filteredEvents.filter(e => {
      if (!e.endDate || e.endDate === e.startDate) return e.startDate === dateStr;
      return dateStr >= e.startDate && dateStr <= e.endDate;
    });
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const handleDayClick = (dateStr: string) => {
    const dayEvents = getEventsForDate(dateStr);
    if (dayEvents.length > 0) {
      setSelectedDay(dayEvents);
      setDayDialogDate(dateStr);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatShortDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isPast = (d: string) => d < todayStr;

  // Get week days for week view
  const getWeekDays = () => {
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });
  };

  const calendarDays = getDaysInMonth();
  const weekDays = getWeekDays();

  // Upcoming events (next 30 days)
  const upcoming = filteredEvents
    .filter(e => e.startDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 8);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">School Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">View and track all school events, exams and holidays</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md overflow-hidden">
            <button onClick={() => setViewMode('month')}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              data-testid="button-view-month">Month</button>
            <button onClick={() => setViewMode('week')}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              data-testid="button-view-week">Week</button>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36" data-testid="select-calendar-filter">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map(t => (
          <button key={t.value} onClick={() => setTypeFilter(typeFilter === t.value ? 'all' : t.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${typeFilter === t.value ? 'ring-2 ring-primary' : ''} ${t.bg}`}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Calendar Grid */}
        <div className="xl:col-span-3">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-prev-month"><ChevronLeft className="w-4 h-4" /></Button>
                <h2 className="text-lg font-semibold min-w-[180px] text-center">{MONTHS[month]} {year}</h2>
                <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-next-month"><ChevronRight className="w-4 h-4" /></Button>
              </div>
              <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">Today</Button>
            </CardHeader>
            <CardContent className="p-0">
              {viewMode === 'month' ? (
                <>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 border-b">
                    {DAYS.map(d => (
                      <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
                    ))}
                  </div>
                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day, idx) => {
                      const dayEvents = getEventsForDate(day.fullDate);
                      const isToday = day.fullDate === todayStr;
                      const isOtherMonth = day.month !== 'current';
                      const past = isPast(day.fullDate) && day.month === 'current';
                      return (
                        <div
                          key={idx}
                          onClick={() => handleDayClick(day.fullDate)}
                          data-testid={`calendar-day-${day.fullDate}`}
                          className={`min-h-[72px] p-1 border-b border-r cursor-pointer hover:bg-muted/50 transition-colors ${isOtherMonth ? 'bg-muted/20' : ''} ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                        >
                          <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-primary text-primary-foreground' : isOtherMonth ? 'text-muted-foreground' : past ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {day.date}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 2).map(ev => {
                              const ti = getTypeInfo(ev.eventType);
                              return (
                                <div key={ev.id}
                                  onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                                  className="text-[10px] font-medium px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                                  style={{ backgroundColor: ti.light, color: ti.color }}
                                  data-testid={`event-dot-${ev.id}`}
                                >
                                  {ev.title}
                                </div>
                              );
                            })}
                            {dayEvents.length > 2 && (
                              <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 2} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Week View */
                <>
                  <div className="grid grid-cols-7 border-b">
                    {weekDays.map(dateStr => {
                      const dt = new Date(dateStr + 'T00:00:00');
                      const isToday = dateStr === todayStr;
                      return (
                        <div key={dateStr} className={`py-3 text-center border-r last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
                          <div className="text-xs font-medium text-muted-foreground">{DAYS[dt.getDay()]}</div>
                          <div className={`text-lg font-semibold mt-0.5 w-9 h-9 flex items-center justify-center rounded-full mx-auto ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                            {dt.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-7 min-h-[240px]">
                    {weekDays.map(dateStr => {
                      const dayEvs = getEventsForDate(dateStr);
                      const isToday = dateStr === todayStr;
                      return (
                        <div key={dateStr} className={`p-1.5 border-r last:border-r-0 space-y-1 ${isToday ? 'bg-primary/5' : ''}`}>
                          {dayEvs.map(ev => {
                            const ti = getTypeInfo(ev.eventType);
                            return (
                              <div key={ev.id}
                                onClick={() => setSelectedEvent(ev)}
                                className="text-xs p-1.5 rounded cursor-pointer hover:opacity-80 font-medium"
                                style={{ backgroundColor: ti.light, color: ti.color }}
                                data-testid={`week-event-${ev.id}`}
                              >
                                <div className="truncate">{ev.title}</div>
                                {!ev.isAllDay && ev.startTime && <div className="text-[10px] opacity-75">{ev.startTime}</div>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Upcoming Events */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(4)].map((_,i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : upcoming.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No upcoming events
                </div>
              ) : (
                <div className="divide-y">
                  {upcoming.map(ev => {
                    const ti = getTypeInfo(ev.eventType);
                    return (
                      <button key={ev.id} onClick={() => setSelectedEvent(ev)}
                        className="w-full flex gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                        data-testid={`upcoming-event-${ev.id}`}>
                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: ti.color }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatShortDate(ev.startDate)}</p>
                          {ev.location && <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
                    <span>{formatDate(selectedEvent.startDate)}{selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate ? ` – ${formatDate(selectedEvent.endDate)}` : ''}</span>
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

      {/* Day Events Dialog */}
      <Dialog open={!!dayDialogDate} onOpenChange={open => { if (!open) { setDayDialogDate(null); setSelectedDay([]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dayDialogDate ? formatDate(dayDialogDate) : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {selectedDay.map(ev => {
              const ti = getTypeInfo(ev.eventType);
              return (
                <button key={ev.id} onClick={() => { setDayDialogDate(null); setSelectedDay([]); setSelectedEvent(ev); }}
                  className="w-full flex gap-3 p-3 rounded-lg border text-left hover:bg-muted/50 transition-colors">
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: ti.color }} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{ev.title}</p>
                    <Badge className={`text-xs mt-1 ${ti.bg}`} variant="secondary">{ti.label}</Badge>
                    {!ev.isAllDay && ev.startTime && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{ev.startTime}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
