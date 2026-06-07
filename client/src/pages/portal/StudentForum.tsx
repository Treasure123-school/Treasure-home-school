import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import {
  MessageSquare, Search, Plus, ThumbsUp, CheckCircle, Flag, Trash2,
  ChevronLeft, X, Paperclip, Clock, User, BookOpen, Send, MessagesSquare,
  Pin, MoreVertical, Tag, ArrowUp, Eye
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Reply {
  id: number;
  author: string;
  authorInitials: string;
  authorRole: 'student' | 'teacher';
  content: string;
  likes: number;
  liked: boolean;
  isCorrect: boolean;
  reported: boolean;
  createdAt: Date;
  parentId?: number;
}
interface Thread {
  id: number;
  title: string;
  content: string;
  author: string;
  authorInitials: string;
  authorRole: 'student' | 'teacher';
  category: string;
  replies: Reply[];
  views: number;
  pinned: boolean;
  createdAt: Date;
  attachment?: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Mathematics', 'English', 'Physics', 'Chemistry', 'Biology', 'History', 'General'];

const makeDate = (daysAgo: number, hoursAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d;
};

const INITIAL_THREADS: Thread[] = [
  {
    id: 1, title: 'How do I solve quadratic equations using the formula?', category: 'Mathematics',
    content: "I'm having trouble understanding the quadratic formula. Can someone explain step by step how to use it? I understand the basics but get confused when the discriminant is negative.",
    author: 'Emeka Johnson', authorInitials: 'EJ', authorRole: 'student',
    views: 42, pinned: true, createdAt: makeDate(2),
    replies: [
      { id: 101, author: 'Mr. Adewale', authorInitials: 'MA', authorRole: 'teacher', content: 'Great question! The quadratic formula is x = (-b ± √(b²-4ac)) / 2a. When the discriminant (b²-4ac) is negative, the equation has no real solutions — it has complex roots instead. For your exams, if you get a negative discriminant, simply state "no real roots".', likes: 8, liked: false, isCorrect: true, reported: false, createdAt: makeDate(1, 20) },
      { id: 102, author: 'Fatima Usman', authorInitials: 'FU', authorRole: 'student', content: 'I found Khan Academy really helpful for this topic. The videos break it down really well.', likes: 3, liked: false, isCorrect: false, reported: false, createdAt: makeDate(1, 10) },
    ],
  },
  {
    id: 2, title: 'Tips for writing a good essay introduction?', category: 'English',
    content: 'Our teacher asked us to write a 5-paragraph essay on the effects of social media. I always struggle with writing a strong introduction. Any tips?',
    author: 'Chinwe Eze', authorInitials: 'CE', authorRole: 'student',
    views: 31, pinned: false, createdAt: makeDate(3),
    replies: [
      { id: 201, author: 'Mrs. Amaka Obi', authorInitials: 'AO', authorRole: 'teacher', content: 'Start with a hook — an interesting fact, quote, or question. Then provide context, and end your intro with a clear thesis statement that outlines your three body paragraph points.', likes: 11, liked: false, isCorrect: true, reported: false, createdAt: makeDate(3, 2) },
      { id: 202, author: 'Samuel Bello', authorInitials: 'SB', authorRole: 'student', content: 'A good hook could be a shocking statistic about social media usage. Something like "Over 4.9 billion people use social media worldwide."', likes: 5, liked: false, isCorrect: false, reported: false, createdAt: makeDate(2, 5) },
    ],
  },
  {
    id: 3, title: 'Confused about Newton\'s Third Law — can someone explain?', category: 'Physics',
    content: 'The textbook says "every action has an equal and opposite reaction" but I don\'t understand why we don\'t just cancel out. If I push a wall, the wall pushes back — so why do I move?',
    author: 'Adebayo Okafor', authorInitials: 'AO', authorRole: 'student',
    views: 58, pinned: false, createdAt: makeDate(5),
    replies: [
      { id: 301, author: 'Dr. Emeka Nwosu', authorInitials: 'EN', authorRole: 'teacher', content: 'Excellent question! The forces act on DIFFERENT objects. When you push the wall, you push ON the wall. The wall pushes ON you. These two forces don\'t cancel because they\'re on separate objects. The wall doesn\'t move because it\'s fixed — but you might slide back!', likes: 14, liked: false, isCorrect: true, reported: false, createdAt: makeDate(4, 18) },
    ],
  },
  {
    id: 4, title: 'Study group for upcoming chemistry exam?', category: 'Chemistry',
    content: 'The mid-term chemistry exam is in two weeks and I\'d like to form a study group. We can meet in the school library during lunch break. Who\'s interested?',
    author: 'Blessing Nkosi', authorInitials: 'BN', authorRole: 'student',
    views: 19, pinned: false, createdAt: makeDate(1),
    replies: [],
  },
  {
    id: 5, title: 'Difference between mitosis and meiosis?', category: 'Biology',
    content: 'I keep mixing up mitosis and meiosis. They sound so similar! Can someone give me a simple way to remember the difference?',
    author: 'Ngozi Peters', authorInitials: 'NP', authorRole: 'student',
    views: 27, pinned: false, createdAt: makeDate(4),
    replies: [
      { id: 501, author: 'Tunde Abiodun', authorInitials: 'TA', authorRole: 'student', content: 'Easy trick: Mitosis = More cells (body cells divide for growth). Meiosis = Mix it up (sex cells divide for reproduction and create genetic diversity).', likes: 9, liked: false, isCorrect: false, reported: false, createdAt: makeDate(3, 12) },
    ],
  },
  {
    id: 6, title: 'When is the next school cultural day?', category: 'General',
    content: 'I heard we have a cultural day coming up. Does anyone know the date and what we need to prepare? Specifically asking about the dance performance.',
    author: 'Kelechi Odom', authorInitials: 'KO', authorRole: 'student',
    views: 35, pinned: false, createdAt: makeDate(6),
    replies: [
      { id: 601, author: 'Mr. Adewale', authorInitials: 'MA', authorRole: 'teacher', content: 'Cultural Day is scheduled for April 25th. Students participating in performances should report to the hall by 8:00 AM. Costumes should reflect your cultural heritage.', likes: 7, liked: false, isCorrect: true, reported: false, createdAt: makeDate(6, 1) },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date: Date) {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getCategoryColor(cat: string) {
  const map: Record<string, string> = {
    Mathematics: 'bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60',
    English: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
    Physics: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    Chemistry: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    Biology: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    History: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    General: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return map[cat] || map.General;
}

function Avatar({ initials, role, size = 'md' }: { initials: string; role: 'student' | 'teacher'; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-xs';
  const bg = role === 'teacher' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  return <div className={`${sz} ${bg} rounded-full flex items-center justify-center font-bold flex-shrink-0`}>{initials}</div>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudentForum() {
  const { user } = useAuth();
  const currentUser = user ? `${user.firstName} ${user.lastName}` : 'You';
  const currentInitials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}` : 'YO';

  const [threads, setThreads] = useState<Thread[]>(INITIAL_THREADS);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create post form
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newFile, setNewFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reply
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  // Modals
  const [reportId, setReportId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ── Filter threads ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let t = threads;
    if (activeCategory !== 'All') t = t.filter(th => th.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      t = t.filter(th => th.title.toLowerCase().includes(q) || th.content.toLowerCase().includes(q) || th.author.toLowerCase().includes(q));
    }
    return [...t].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt.getTime() - a.createdAt.getTime());
  }, [threads, activeCategory, search]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const submitPost = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    const t: Thread = {
      id: Date.now(), title: newTitle.trim(), content: newContent.trim(),
      author: currentUser, authorInitials: currentInitials, authorRole: 'student',
      category: newCategory, replies: [], views: 0, pinned: false,
      createdAt: new Date(), attachment: newFile ?? undefined,
    };
    setThreads(prev => [t, ...prev]);
    setNewTitle(''); setNewContent(''); setNewCategory('General'); setNewFile(null);
    setShowCreate(false);
    setSelectedThread(t);
  };

  const submitReply = () => {
    if (!replyText.trim() || !selectedThread) return;
    const r: Reply = {
      id: Date.now(), author: currentUser, authorInitials: currentInitials,
      authorRole: 'student', content: replyText.trim(), likes: 0, liked: false,
      isCorrect: false, reported: false, createdAt: new Date(),
      parentId: replyingTo ?? undefined,
    };
    const updated = threads.map(th =>
      th.id === selectedThread.id ? { ...th, replies: [...th.replies, r] } : th
    );
    setThreads(updated);
    setSelectedThread(updated.find(t => t.id === selectedThread.id)!);
    setReplyText(''); setReplyingTo(null);
  };

  const toggleLike = (replyId: number) => {
    if (!selectedThread) return;
    const updated = threads.map(th =>
      th.id === selectedThread.id
        ? { ...th, replies: th.replies.map(r => r.id === replyId ? { ...r, liked: !r.liked, likes: r.liked ? r.likes - 1 : r.likes + 1 } : r) }
        : th
    );
    setThreads(updated);
    setSelectedThread(updated.find(t => t.id === selectedThread.id)!);
  };

  const markCorrect = (replyId: number) => {
    if (!selectedThread) return;
    const updated = threads.map(th =>
      th.id === selectedThread.id
        ? { ...th, replies: th.replies.map(r => r.id === replyId ? { ...r, isCorrect: !r.isCorrect } : r) }
        : th
    );
    setThreads(updated);
    setSelectedThread(updated.find(t => t.id === selectedThread.id)!);
  };

  const reportReply = (replyId: number) => {
    if (!selectedThread) return;
    const updated = threads.map(th =>
      th.id === selectedThread.id
        ? { ...th, replies: th.replies.map(r => r.id === replyId ? { ...r, reported: true } : r) }
        : th
    );
    setThreads(updated);
    setSelectedThread(updated.find(t => t.id === selectedThread.id)!);
    setReportId(null);
  };

  const deleteReply = (replyId: number) => {
    if (!selectedThread) return;
    const updated = threads.map(th =>
      th.id === selectedThread.id
        ? { ...th, replies: th.replies.filter(r => r.id !== replyId) }
        : th
    );
    setThreads(updated);
    setSelectedThread(updated.find(t => t.id === selectedThread.id)!);
    setDeleteId(null);
  };

  const openThread = (thread: Thread) => {
    const updated = threads.map(th => th.id === thread.id ? { ...th, views: th.views + 1 } : th);
    setThreads(updated);
    setSelectedThread(updated.find(t => t.id === thread.id)!);
    setReplyText(''); setReplyingTo(null);
  };

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    threads.forEach(t => { map[t.category] = (map[t.category] || 0) + 1; });
    return map;
  }, [threads]);

  // ════════════════════════════════════════════════════════════════════════════
  // THREAD DETAIL VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (selectedThread) {
    const topReplies = selectedThread.replies.filter(r => !r.parentId);
    const hasCorrect = selectedThread.replies.some(r => r.isCorrect);

    return (
      <div className="space-y-4 pb-8" data-testid="forum-thread-detail">
        {/* Back */}
        <button
          onClick={() => setSelectedThread(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-gray-800 dark:hover:text-gray-200 transition-colors font-medium"
          data-testid="button-back-to-forum"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Discussions
        </button>

        {/* Solved banner */}
        {hasCorrect && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">This discussion has a verified answer</span>
          </div>
        )}

        {/* Original Post */}
        <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <Avatar initials={selectedThread.authorInitials} role={selectedThread.authorRole} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{selectedThread.author}</span>
                  {selectedThread.authorRole === 'teacher' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60 uppercase tracking-wide">Teacher</span>
                  )}
                  <span className="text-xs text-muted-foreground">{timeAgo(selectedThread.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getCategoryColor(selectedThread.category)}`}>
                    {selectedThread.category}
                  </span>
                  {selectedThread.pinned && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <Pin className="h-3 w-3" /> Pinned
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="h-3.5 w-3.5" />{selectedThread.views}
              </div>
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">{selectedThread.title}</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{selectedThread.content}</p>

            {selectedThread.attachment && (
              <div className="mt-3 flex items-center gap-2 text-sm text-primary dark:text-primary/70">
                <Paperclip className="h-4 w-4" />
                <span className="underline cursor-pointer">{selectedThread.attachment}</span>
              </div>
            )}

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{selectedThread.replies.length} replies</div>
            </div>
          </CardContent>
        </Card>

        {/* Replies */}
        {selectedThread.replies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <MessageSquare className="h-5 w-5 text-gray-400" />
            </div>
            <p className="font-medium text-gray-600 dark:text-gray-400 text-sm">No replies yet</p>
            <p className="text-xs text-muted-foreground mt-1">Be the first to reply to this discussion.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {selectedThread.replies.length} {selectedThread.replies.length === 1 ? 'Reply' : 'Replies'}
            </p>
            {topReplies.map(reply => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                onLike={() => toggleLike(reply.id)}
                onMarkCorrect={() => markCorrect(reply.id)}
                onReport={() => setReportId(reply.id)}
                onDelete={() => setDeleteId(reply.id)}
                onReplyTo={() => setReplyingTo(reply.id)}
                currentUser={currentUser}
                isTeacher={selectedThread.authorRole === 'teacher' || user?.role === 'teacher'}
              />
            ))}
          </div>
        )}

        {/* Reply Box */}
        <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-primary/5 dark:bg-primary/5 border border-primary/20 dark:border-primary/30">
                <span className="text-xs text-primary dark:text-primary/60 font-medium">
                  Replying to: {selectedThread.replies.find(r => r.id === replyingTo)?.author}
                </span>
                <button onClick={() => setReplyingTo(null)} className="ml-auto" data-testid="button-cancel-reply-to">
                  <X className="h-3.5 w-3.5 text-primary" />
                </button>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Avatar initials={currentInitials} role="student" />
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Write a helpful reply…"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="resize-none min-h-[80px] text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  data-testid="textarea-reply"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={submitReply}
                    disabled={!replyText.trim()}
                    className="gap-2"
                    data-testid="button-submit-reply"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Post Reply
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Confirm */}
        {reportId !== null && (
          <ConfirmModal
            title="Report this reply?"
            message="This reply will be flagged for moderator review."
            confirmLabel="Report"
            confirmClass="bg-red-600 hover:bg-red-700 text-white"
            onConfirm={() => reportReply(reportId)}
            onCancel={() => setReportId(null)}
          />
        )}
        {/* Delete Confirm */}
        {deleteId !== null && (
          <ConfirmModal
            title="Delete this reply?"
            message="This action cannot be undone."
            confirmLabel="Delete"
            confirmClass="bg-red-600 hover:bg-red-700 text-white"
            onConfirm={() => deleteReply(deleteId)}
            onCancel={() => setDeleteId(null)}
          />
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MAIN FORUM VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 pb-8" data-testid="forum-main">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Discussion Forum</h1>
          <p className="text-sm text-muted-foreground mt-1">Ask questions, share knowledge, and learn together</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 self-start sm:self-auto" data-testid="button-create-post">
          <Plus className="h-4 w-4" />
          New Discussion
        </Button>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 flex-wrap">
        {[
          { icon: MessagesSquare, label: 'Threads', value: threads.length, color: 'text-primary', bg: 'bg-primary/5 dark:bg-primary/5' },
          { icon: MessageSquare, label: 'Replies', value: threads.reduce((s, t) => s + t.replies.length, 0), color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/40' },
          { icon: CheckCircle, label: 'Answered', value: threads.filter(t => t.replies.some(r => r.isCorrect)).length, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 ${bg}`}>
            <Icon className={`h-4 w-4 ${color}`} />
            <span className={`text-sm font-bold ${color}`}>{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search discussions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
          data-testid="input-search-forum"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="button-clear-search">
            <X className="h-4 w-4 text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300" />
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
              activeCategory === cat
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-primary/40 hover:text-primary dark:hover:text-primary/70'
            }`}
            data-testid={`filter-category-${cat}`}
          >
            {cat}
            {cat !== 'All' && categoryCounts[cat] ? (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${activeCategory === cat ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                {categoryCounts[cat]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Thread List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="empty-state-forum">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <MessagesSquare className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {search ? 'No results found' : 'No discussions yet'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-5">
            {search ? `Try a different search term.` : 'Be the first to start a discussion in this category!'}
          </p>
          {!search && (
            <Button onClick={() => setShowCreate(true)} variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Start Discussion
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(thread => {
            const lastReply = thread.replies[thread.replies.length - 1];
            const lastActivity = lastReply ? lastReply.createdAt : thread.createdAt;
            const isAnswered = thread.replies.some(r => r.isCorrect);
            return (
              <button
                key={thread.id}
                onClick={() => openThread(thread)}
                className="w-full text-left block"
                data-testid={`thread-item-${thread.id}`}
              >
                <Card className="border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-primary/30 dark:hover:border-primary/70 transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Status indicator column */}
                      <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                        <Avatar initials={thread.authorInitials} role={thread.authorRole} size="sm" />
                        {isAnswered && (
                          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center mt-1" title="Answered">
                            <CheckCircle className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {thread.pinned && <Pin className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                              <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 line-clamp-1">{thread.title}</h3>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{thread.content}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getCategoryColor(thread.category)}`}>
                                {thread.category}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{thread.author}</span>
                              <span className="text-[11px] text-muted-foreground">· {timeAgo(thread.createdAt)}</span>
                            </div>
                          </div>

                          {/* Meta */}
                          <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span className="font-medium text-gray-700 dark:text-gray-300">{thread.replies.length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              <span>{thread.views}</span>
                            </div>
                            {lastReply && (
                              <span className="text-[10px] text-right leading-tight">{timeAgo(lastActivity)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Create Post Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" data-testid="create-post-modal">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">New Discussion</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" data-testid="button-close-create">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Title *</label>
                <Input
                  placeholder="What's your question or topic?"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  data-testid="input-post-title"
                  maxLength={120}
                />
                <p className="text-[11px] text-muted-foreground mt-1 text-right">{newTitle.length}/120</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Category *</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                        newCategory === cat
                          ? 'bg-primary text-white border-primary'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-primary/40'
                      }`}
                      data-testid={`select-cat-${cat}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Message *</label>
                <Textarea
                  placeholder="Describe your question or start the discussion in detail…"
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  className="resize-none min-h-[120px] text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  data-testid="textarea-post-content"
                />
              </div>

              {/* File attachment */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Attachment (optional)</label>
                {newFile ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 dark:bg-primary/5 border border-primary/20 dark:border-primary/30 text-sm">
                    <Paperclip className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-primary dark:text-primary/60 flex-1 truncate">{newFile}</span>
                    <button onClick={() => setNewFile(null)} data-testid="button-remove-file">
                      <X className="h-4 w-4 text-primary" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors w-full"
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="h-4 w-4" />
                    Click to attach a file
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) setNewFile(e.target.files[0].name); }}
                  data-testid="input-file"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)} data-testid="button-cancel-create">
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={submitPost}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  data-testid="button-submit-post"
                >
                  <Send className="h-4 w-4" />
                  Post Discussion
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reply Card ────────────────────────────────────────────────────────────────
function ReplyCard({
  reply, onLike, onMarkCorrect, onReport, onDelete, onReplyTo, currentUser, isTeacher
}: {
  reply: Reply;
  onLike: () => void;
  onMarkCorrect: () => void;
  onReport: () => void;
  onDelete: () => void;
  onReplyTo: () => void;
  currentUser: string;
  isTeacher?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isOwn = reply.author === currentUser;

  return (
    <Card
      className={`border shadow-sm transition-all ${reply.isCorrect ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-gray-200 dark:border-gray-700'} ${reply.reported ? 'opacity-50' : ''}`}
      data-testid={`reply-card-${reply.id}`}
    >
      <CardContent className="p-4">
        {reply.isCorrect && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-3">
            <CheckCircle className="h-4 w-4" />
            Verified Answer
          </div>
        )}
        {reply.reported && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-2">
            <Flag className="h-3.5 w-3.5" /> Reported — under review
          </div>
        )}

        <div className="flex items-start gap-3">
          <Avatar initials={reply.authorInitials} role={reply.authorRole} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{reply.author}</span>
              {reply.authorRole === 'teacher' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60 uppercase tracking-wide">Teacher</span>
              )}
              <span className="text-xs text-muted-foreground">{timeAgo(reply.createdAt)}</span>
              {/* Overflow menu */}
              <div className="ml-auto relative">
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  data-testid={`button-menu-reply-${reply.id}`}
                >
                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-7 z-20 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 overflow-hidden">
                    <button onClick={() => { onReplyTo(); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                      <MessageSquare className="h-3.5 w-3.5" /> Reply
                    </button>
                    {isTeacher && (
                      <button onClick={() => { onMarkCorrect(); setShowMenu(false); }} className={`flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 ${reply.isCorrect ? 'text-amber-600' : 'text-emerald-600'}`}>
                        <CheckCircle className="h-3.5 w-3.5" /> {reply.isCorrect ? 'Unmark Answer' : 'Mark as Answer'}
                      </button>
                    )}
                    {!isOwn && !reply.reported && (
                      <button onClick={() => { onReport(); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 text-red-600">
                        <Flag className="h-3.5 w-3.5" /> Report
                      </button>
                    )}
                    {isOwn && (
                      <button onClick={() => { onDelete(); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 text-red-600">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-2 whitespace-pre-line">{reply.content}</p>

            {/* Like button */}
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={onLike}
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                  reply.liked
                    ? 'bg-primary/5 dark:bg-primary/5 text-primary dark:text-primary/70 border-primary/30 dark:border-primary/30'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-primary/40 hover:text-primary'
                }`}
                data-testid={`button-like-reply-${reply.id}`}
              >
                <ThumbsUp className="h-3 w-3" />
                {reply.likes > 0 ? reply.likes : 'Like'}
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; confirmClass: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" data-testid="confirm-modal">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-5">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} data-testid="button-cancel-confirm">Cancel</Button>
          <button className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${confirmClass}`} onClick={onConfirm} data-testid="button-confirm-action">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
