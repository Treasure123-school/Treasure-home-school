import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trophy, Users, Clock, User, Calendar, Star, ChevronRight,
  ChevronLeft, X, Zap, Music, Palette, Dumbbell, Code, FlaskConical, Globe
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, any> = {
  Sports: Dumbbell,
  Arts: Palette,
  Music: Music,
  Technology: Code,
  Science: FlaskConical,
  Debate: Globe,
  Default: Star,
};

const DEMO_ACTIVITIES = [
  {
    id: 1,
    name: 'Football Club',
    category: 'Sports',
    description: 'Competitive football training and matches. Open to all skill levels. We participate in inter-school tournaments across the state.',
    schedule: 'Tuesday & Thursday, 3:00 PM – 5:00 PM',
    coach: 'Mr. Adewale Okafor',
    members: 24,
    maxMembers: 30,
    color: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    iconColor: 'text-emerald-600',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    achievements: ['State Champions 2024', 'Inter-school Cup Finalist 2023'],
  },
  {
    id: 2,
    name: 'Drama & Theatre',
    category: 'Arts',
    description: 'Develop acting, stage craft, and creative expression. Annual stage productions and participation in cultural events.',
    schedule: 'Wednesday, 2:00 PM – 4:00 PM',
    coach: 'Mrs. Chinwe Eze',
    members: 18,
    maxMembers: 25,
    color: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
    iconColor: 'text-purple-600',
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
    achievements: ['Best Drama Club 2024'],
  },
  {
    id: 3,
    name: 'Music & Choir',
    category: 'Music',
    description: 'Voice training, instrument lessons, and ensemble performance. We perform at school events and external competitions.',
    schedule: 'Monday & Friday, 1:00 PM – 3:00 PM',
    coach: 'Mr. Samuel Bello',
    members: 32,
    maxMembers: 40,
    color: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    achievements: ['State Choir Competition Silver 2024'],
  },
  {
    id: 4,
    name: 'Coding Club',
    category: 'Technology',
    description: 'Learn programming, web development, and problem solving through fun projects and hackathons.',
    schedule: 'Thursday, 2:00 PM – 4:30 PM',
    coach: 'Ms. Fatima Usman',
    members: 15,
    maxMembers: 20,
    color: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
    iconColor: 'text-cyan-600',
    badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
    achievements: ['School Hackathon Winners 2024'],
  },
  {
    id: 5,
    name: 'Science Quiz Team',
    category: 'Science',
    description: 'Prepare for science olympiads and inter-school quiz competitions covering Physics, Chemistry, and Biology.',
    schedule: 'Wednesday & Friday, 3:00 PM – 4:30 PM',
    coach: 'Dr. Emeka Nwosu',
    members: 12,
    maxMembers: 16,
    color: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    achievements: ['National Science Quiz Top 10 2024'],
  },
  {
    id: 6,
    name: 'Debate Society',
    category: 'Debate',
    description: 'Sharpen critical thinking and public speaking skills. Compete in local, national, and international debate competitions.',
    schedule: 'Tuesday, 2:00 PM – 4:00 PM',
    coach: 'Mrs. Amaka Obi',
    members: 20,
    maxMembers: 24,
    color: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
    iconColor: 'text-rose-600',
    badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    achievements: ['Regional Debate Champions 2024'],
  },
];

const UPCOMING_EVENTS = [
  { id: 1, title: 'Inter-School Football Tournament', type: 'Competition', date: '2026-04-05', activity: 'Football Club', color: 'border-l-emerald-500', typeBadge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  { id: 2, title: 'Annual School Concert', type: 'Performance', date: '2026-04-12', activity: 'Music & Choir', color: 'border-l-blue-500', typeBadge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  { id: 3, title: 'State Science Olympiad', type: 'Competition', date: '2026-04-20', activity: 'Science Quiz Team', color: 'border-l-amber-500', typeBadge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  { id: 4, title: 'Coding Hackathon 2026', type: 'Event', date: '2026-05-03', activity: 'Coding Club', color: 'border-l-cyan-500', typeBadge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300' },
  { id: 5, title: 'End-of-Term Drama Show', type: 'Performance', date: '2026-05-15', activity: 'Drama & Theatre', color: 'border-l-purple-500', typeBadge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
];

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function StudentExtracurricular() {
  const [joinedIds, setJoinedIds] = useState<number[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<typeof DEMO_ACTIVITIES[0] | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');

  const categories = useMemo(() => {
    const s = new Set(DEMO_ACTIVITIES.map(a => a.category));
    return ['all', ...Array.from(s)];
  }, []);

  const filtered = useMemo(() =>
    filterCategory === 'all' ? DEMO_ACTIVITIES : DEMO_ACTIVITIES.filter(a => a.category === filterCategory),
    [filterCategory]
  );

  const joined = DEMO_ACTIVITIES.filter(a => joinedIds.includes(a.id));

  const toggle = (id: number) => {
    setJoinedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6 pb-6" data-testid="extracurricular-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Extracurricular Activities</h1>
          <p className="text-sm text-muted-foreground mt-1">Explore clubs, teams, and activities at your school</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
            <Trophy className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{DEMO_ACTIVITIES.length} Activities</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <Star className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{joinedIds.length} Joined</span>
          </div>
        </div>
      </div>

      {/* My Activities Summary */}
      {joined.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              My Activities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {joined.map(a => {
                const Icon = CATEGORY_ICONS[a.category] || CATEGORY_ICONS.Default;
                return (
                  <div key={a.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${a.color}`}>
                    <Icon className={`h-3.5 w-3.5 ${a.iconColor}`} />
                    <span className={`font-medium text-xs ${a.iconColor}`}>{a.name}</span>
                    <button onClick={() => toggle(a.id)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity" data-testid={`leave-chip-${a.id}`}>
                      <X className={`h-3 w-3 ${a.iconColor}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
              filterCategory === cat
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:text-blue-600'
            }`}
            data-testid={`filter-cat-${cat}`}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Activity Cards */}
      {filtered.length === 0 ? (
        <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state-activities">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Trophy className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">No activities found</h3>
            <p className="text-sm text-muted-foreground">Try a different category filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(activity => {
            const isJoined = joinedIds.includes(activity.id);
            const isFull = activity.members >= activity.maxMembers && !isJoined;
            const Icon = CATEGORY_ICONS[activity.category] || CATEGORY_ICONS.Default;
            const fillPct = Math.round((activity.members / activity.maxMembers) * 100);

            return (
              <Card
                key={activity.id}
                className={`border ${activity.color} shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden`}
                data-testid={`activity-card-${activity.id}`}
              >
                {isJoined && (
                  <div className="absolute top-3 right-3">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-semibold shadow">
                      <Star className="h-2.5 w-2.5 fill-white" /> Joined
                    </div>
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${activity.color}`}>
                      <Icon className={`h-5 w-5 ${activity.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{activity.name}</h3>
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${activity.badgeColor}`}>
                        {activity.category}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{activity.description}</p>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{activity.schedule}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{activity.coach}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{activity.members}/{activity.maxMembers} members</span>
                    </div>
                  </div>

                  {/* Members bar */}
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-4 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all ${fillPct >= 90 ? 'bg-red-400' : 'bg-blue-400'}`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant={isJoined ? 'outline' : 'default'}
                      size="sm"
                      className={`flex-1 text-xs font-semibold ${isJoined ? 'border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30' : ''}`}
                      disabled={isFull}
                      onClick={() => toggle(activity.id)}
                      data-testid={`button-${isJoined ? 'leave' : 'join'}-${activity.id}`}
                    >
                      {isFull ? 'Full' : isJoined ? 'Leave' : 'Join'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedActivity(activity)}
                      data-testid={`button-details-${activity.id}`}
                    >
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upcoming Events */}
      <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {UPCOMING_EVENTS.map(event => {
            const days = daysUntil(event.date);
            return (
              <div key={event.id} className={`flex gap-4 p-3 rounded-xl bg-white dark:bg-gray-900 border-l-4 border border-gray-100 dark:border-gray-800 ${event.color}`} data-testid={`event-${event.id}`}>
                <div className="min-w-[52px] text-center">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                    {new Date(event.date).toLocaleDateString('en-GB', { month: 'short' })}
                  </p>
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-200 leading-tight">
                    {new Date(event.date).getDate()}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{event.activity}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${event.typeBadge}`}>{event.type}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days > 0 ? `In ${days} days` : 'Passed'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" data-testid="activity-detail-modal">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className={`p-6 rounded-t-2xl border-b border-gray-100 dark:border-gray-800 ${selectedActivity.color}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = CATEGORY_ICONS[selectedActivity.category] || CATEGORY_ICONS.Default;
                    return (
                      <div className="w-12 h-12 rounded-xl bg-white/70 dark:bg-gray-800/70 flex items-center justify-center shadow-sm">
                        <Icon className={`h-6 w-6 ${selectedActivity.iconColor}`} />
                      </div>
                    );
                  })()}
                  <div>
                    <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">{selectedActivity.name}</h2>
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${selectedActivity.badgeColor}`}>
                      {selectedActivity.category}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedActivity(null)} className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors" data-testid="button-close-modal">
                  <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{selectedActivity.description}</p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Schedule</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{selectedActivity.schedule}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Coach / Supervisor</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{selectedActivity.coach}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Members</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{selectedActivity.members} / {selectedActivity.maxMembers}</p>
                  </div>
                </div>
              </div>

              {selectedActivity.achievements.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Achievements</p>
                  <div className="space-y-1.5">
                    {selectedActivity.achievements.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Trophy className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                className="w-full font-semibold"
                variant={joinedIds.includes(selectedActivity.id) ? 'outline' : 'default'}
                onClick={() => { toggle(selectedActivity.id); setSelectedActivity(null); }}
                data-testid={`button-modal-${joinedIds.includes(selectedActivity.id) ? 'leave' : 'join'}`}
              >
                {joinedIds.includes(selectedActivity.id) ? 'Leave Activity' : 'Join Activity'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
