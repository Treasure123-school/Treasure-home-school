import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Plus, Search, Edit2, Trash2, Eye, Link, Unlink,
  Copy, Check, Phone, Mail, GraduationCap, UserCheck, UserX,
  Filter, X, ChevronDown, Key, ShieldCheck, UserPlus, BookOpen,
  Hash, CheckCircle2, ImageIcon, AlertCircle
} from 'lucide-react';
import { computeProfileCompletion } from '@/lib/profileCompletion';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkedStudent {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  username: string;
  className: string;
  classId: number;
}

interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  username: string;
  isActive: boolean;
  status: string;
  linkedStudents: LinkedStudent[];
  createdAt: string;
}

interface StudentResult {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  username: string;
  className: string;
  classId: number;
  parentId: string | null;
}

interface Credentials {
  username: string;
  password: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(p: Pick<Parent, 'firstName' | 'lastName'>) {
  return `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase();
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-gray-400" />}
    </button>
  );
}

// ─── Student Autocomplete Input ────────────────────────────────────────────────

function StudentSearch({
  selectedStudents,
  onSelect,
  onRemove,
  excludeIds = [],
}: {
  selectedStudents: StudentResult[];
  onSelect: (s: StudentResult) => void;
  onRemove: (id: string) => void;
  excludeIds?: string[];
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: results = [], isFetching } = useQuery<StudentResult[]>({
    queryKey: ['/api/students/search', q],
    queryFn: async () => {
      if (!q.trim() || q.trim().length < 1) return [];
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: q.trim().length >= 1,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = results.filter(r => !excludeIds.includes(r.id) && !selectedStudents.some(s => s.id === r.id));

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div ref={ref} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, username, or admission no..."
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="pl-9 rounded-xl"
            data-testid="input-student-search"
          />
          {isFetching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Dropdown results */}
        {open && q.trim().length >= 1 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                {isFetching ? 'Searching...' : 'No students found'}
              </div>
            ) : (
              filtered.map(student => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => { onSelect(student); setQ(''); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
                  data-testid={`student-result-${student.id}`}
                >
                  <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    {student.firstName[0]}{student.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {student.className} · {student.username} · {student.admissionNumber}
                    </p>
                  </div>
                  {student.parentId && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:text-amber-400 flex-shrink-0">
                      Linked
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected chips */}
      {selectedStudents.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
          {selectedStudents.map(s => (
            <div
              key={s.id}
              className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-lg px-2.5 py-1 text-xs font-medium"
              data-testid={`chip-student-${s.id}`}
            >
              <GraduationCap className="h-3 w-3" />
              <span>{s.firstName} {s.lastName}</span>
              <span className="text-indigo-400">·</span>
              <span className="text-indigo-400">{s.className}</span>
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                className="ml-0.5 text-indigo-400 hover:text-red-500 transition-colors"
                data-testid={`remove-chip-${s.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ParentManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{ parent: any; credentials: Credentials } | null>(null);
  const [detailParent, setDetailParent] = useState<Parent | null>(null);
  const [editParent, setEditParent] = useState<Parent | null>(null);
  const [linkMoreParent, setLinkMoreParent] = useState<Parent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Parent | null>(null);
  const [linkMoreSelected, setLinkMoreSelected] = useState<StudentResult[]>([]);

  // Form state
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', gender: '' });
  const [selectedStudents, setSelectedStudents] = useState<StudentResult[]>([]);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  // ── Data ─────────────────────────────────────────────────────────────────────

  const { data: parents = [], isLoading } = useQuery<Parent[]>({
    queryKey: ['/api/parents'],
    queryFn: async () => {
      const res = await fetch('/api/parents', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch parents');
      return res.json();
    },
  });

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const res = await fetch('/api/classes', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/parents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/parents'] });
      setIsAddOpen(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', gender: '' });
      setSelectedStudents([]);
      setCredentialsModal({ parent: data.user, credentials: data.credentials });
      toast({ title: 'Parent created', description: `Account created for ${data.user.firstName} ${data.user.lastName}` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/parents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/parents'] });
      setEditParent(null);
      toast({ title: 'Updated', description: 'Parent information updated.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const linkMutation = useMutation({
    mutationFn: async ({ parentId, studentIds }: { parentId: string; studentIds: string[] }) => {
      const res = await fetch(`/api/parents/${parentId}/link-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ studentIds }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/parents'] });
      setLinkMoreParent(null);
      setLinkMoreSelected([]);
      toast({ title: 'Linked', description: 'Students linked successfully.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const unlinkMutation = useMutation({
    mutationFn: async ({ parentId, studentId }: { parentId: string; studentId: string }) => {
      const res = await fetch(`/api/parents/${parentId}/unlink/${studentId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/parents'] });
      if (detailParent?.id === vars.parentId) {
        setDetailParent(prev => prev ? {
          ...prev,
          linkedStudents: prev.linkedStudents.filter(s => s.id !== vars.studentId)
        } : null);
      }
      toast({ title: 'Unlinked', description: 'Student removed from this parent.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const endpoint = active ? 'unsuspend' : 'suspend';
      const res = await fetch(`/api/users/${id}/${endpoint}`, { method: 'POST', credentials: 'include' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/parents'] });
      toast({ title: vars.active ? 'Activated' : 'Deactivated', description: `Parent account has been ${vars.active ? 'activated' : 'deactivated'}.` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}/smart-delete`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/parents'] });
      setDeleteConfirm(null);
      toast({ title: 'Deleted', description: 'Parent account removed.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Filtering ─────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = [...parents];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.username?.toLowerCase().includes(q)
      );
    }
    if (classFilter !== 'all') {
      list = list.filter(p => p.linkedStudents.some(s => String(s.classId) === classFilter));
    }
    if (completionFilter !== 'all') {
      list = list.filter(p => {
        const completion = computeProfileCompletion({
          profileImageUrl: (p as any).profileImageUrl,
          phone: p.phone,
          email: p.email,
          address: (p as any).address,
        });
        return completionFilter === 'complete' ? completion.isComplete : !completion.isComplete;
      });
    }
    return list;
  }, [parents, search, classFilter, completionFilter]);

  const handleCreate = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({ title: 'Required', description: 'First and last name are required.', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      ...form,
      studentIds: selectedStudents.map(s => s.id),
    });
  };

  const handleUpdate = () => {
    if (!editParent) return;
    updateMutation.mutate({ id: editParent.id, data: editForm });
  };

  const openEdit = (p: Parent) => {
    setEditParent(p);
    setEditForm({ firstName: p.firstName, lastName: p.lastName, email: p.email ?? '', phone: p.phone ?? '' });
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
            <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Parent Management</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{parents.length} parent{parents.length !== 1 ? 's' : ''} registered</p>
          </div>
        </div>
        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2"
          data-testid="button-add-parent"
        >
          <Plus className="h-4 w-4" />
          Add Parent
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, email or username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl text-sm"
            data-testid="input-search-parents"
          />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-auto sm:w-44 rounded-xl text-sm border-gray-200 dark:border-gray-700">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            <SelectValue placeholder="Filter by class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={completionFilter} onValueChange={(v) => setCompletionFilter(v as 'all' | 'complete' | 'incomplete')}>
          <SelectTrigger className="w-auto sm:w-48 rounded-xl text-sm border-gray-200 dark:border-gray-700" data-testid="select-completion-filter">
            <SelectValue placeholder="Profile completion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Profiles</SelectItem>
            <SelectItem value="complete">Complete (100%)</SelectItem>
            <SelectItem value="incomplete">Incomplete (&lt;100%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Parent List */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-16 text-center">
          <div className="bg-violet-50 dark:bg-violet-900/20 rounded-full p-5 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <Users className="h-9 w-9 text-violet-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {search || classFilter !== 'all' ? 'No parents match your search' : 'No parents registered yet'}
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            {search || classFilter !== 'all' ? 'Try adjusting your filters.' : 'Add your first parent to get started.'}
          </p>
          {!search && classFilter === 'all' && (
            <Button onClick={() => setIsAddOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              Add First Parent
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(parent => {
            const parentCompletion = computeProfileCompletion({
              profileImageUrl: (parent as any).profileImageUrl,
              phone: parent.phone,
              email: parent.email,
              address: (parent as any).address,
            });
            return (
            <div
              key={parent.id}
              className={`bg-white dark:bg-gray-900 rounded-2xl border p-4 hover:shadow-md transition-shadow flex flex-col gap-3 ${parentCompletion.isComplete ? 'border-gray-200 dark:border-gray-700' : 'border-amber-200 dark:border-amber-800/50'}`}
              data-testid={`card-parent-${parent.id}`}
            >
              {/* Card header */}
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  parent.isActive && parent.status !== 'suspended'
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>
                  {initials(parent)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {parent.firstName} {parent.lastName}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
                        parent.isActive && parent.status !== 'suspended'
                          ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400'
                          : 'border-gray-300 text-gray-500'
                      }`}
                    >
                      {parent.isActive && parent.status !== 'suspended' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{parent.username}</p>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-1">
                {parent.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{parent.phone}</span>
                  </div>
                )}
                {parent.email && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Mail className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{parent.email}</span>
                  </div>
                )}
              </div>

              {/* Profile Completion */}
              <div data-testid={`completion-${parent.id}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Profile</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${parentCompletion.isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {parentCompletion.percentage}%
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 h-4 ${parentCompletion.isComplete ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400' : 'border-amber-300 text-amber-700 dark:text-amber-400'}`}
                    >
                      {parentCompletion.isComplete ? 'Complete' : 'Incomplete'}
                    </Badge>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all ${parentCompletion.isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${parentCompletion.percentage}%` }}
                  />
                </div>
                {!parentCompletion.isComplete && parentCompletion.missingFields.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {parentCompletion.missingFields.map(f => (
                      <span key={f.key} className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-md">
                        {f.label} missing
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked students */}
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Linked Students ({parent.linkedStudents.length})
                </p>
                {parent.linkedStudents.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No students linked</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {parent.linkedStudents.slice(0, 3).map(s => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-lg"
                      >
                        <GraduationCap className="h-2.5 w-2.5" />
                        {s.firstName} {s.lastName}
                      </span>
                    ))}
                    {parent.linkedStudents.length > 3 && (
                      <span className="text-[11px] text-gray-400">+{parent.linkedStudents.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setDetailParent(parent)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  data-testid={`button-view-${parent.id}`}
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
                <button
                  onClick={() => openEdit(parent)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  data-testid={`button-edit-${parent.id}`}
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => { setLinkMoreParent(parent); setLinkMoreSelected([]); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                  data-testid={`button-link-${parent.id}`}
                >
                  <Link className="h-3.5 w-3.5" /> Link
                </button>
                <button
                  onClick={() => toggleActiveMutation.mutate({ id: parent.id, active: !(parent.isActive && parent.status !== 'suspended') })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-colors ${
                    parent.isActive && parent.status !== 'suspended'
                      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                      : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                  }`}
                  data-testid={`button-toggle-${parent.id}`}
                >
                  {parent.isActive && parent.status !== 'suspended'
                    ? <><UserX className="h-3.5 w-3.5" /> Disable</>
                    : <><UserCheck className="h-3.5 w-3.5" /> Enable</>
                  }
                </button>
                <button
                  onClick={() => setDeleteConfirm(parent)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  data-testid={`button-delete-${parent.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* ── ADD PARENT DIALOG ─────────────────────────────────────────────────── */}
      <Dialog open={isAddOpen} onOpenChange={open => { if (!open) { setIsAddOpen(false); setForm({ firstName: '', lastName: '', email: '', phone: '', gender: '' }); setSelectedStudents([]); } }}>
        <DialogContent className="sm:max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <UserPlus className="h-5 w-5 text-violet-600" />
              Add New Parent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">First Name *</Label>
                <Input
                  placeholder="e.g. John"
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  className="rounded-xl"
                  data-testid="input-first-name"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Last Name *</Label>
                <Input
                  placeholder="e.g. Doe"
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  className="rounded-xl"
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Phone Number</Label>
              <Input
                placeholder="e.g. +234 800 000 0000"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="rounded-xl"
                data-testid="input-phone"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Email Address (optional)</Label>
              <Input
                type="email"
                placeholder="e.g. parent@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="rounded-xl"
                data-testid="input-email"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Link Students
                <span className="ml-1 text-gray-400 font-normal">(search and select)</span>
              </Label>
              <StudentSearch
                selectedStudents={selectedStudents}
                onSelect={s => setSelectedStudents(prev => [...prev, s])}
                onRemove={id => setSelectedStudents(prev => prev.filter(s => s.id !== id))}
              />
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Key className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Login credentials (username + password) will be automatically generated and shown after account creation.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setIsAddOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!form.firstName.trim() || !form.lastName.trim() || createMutation.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2"
                data-testid="button-submit-parent"
              >
                <UserPlus className="h-4 w-4" />
                {createMutation.isPending ? 'Creating...' : 'Create Parent'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CREDENTIALS MODAL ─────────────────────────────────────────────────── */}
      <Dialog open={!!credentialsModal} onOpenChange={open => { if (!open) setCredentialsModal(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              Account Created Successfully
            </DialogTitle>
          </DialogHeader>
          {credentialsModal && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Login credentials for <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {credentialsModal.parent.firstName} {credentialsModal.parent.lastName}
                </span> have been generated. Please share these securely.
              </p>
              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Username</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-gray-900 dark:text-gray-100 font-semibold">
                      {credentialsModal.credentials.username}
                    </code>
                    <CopyBtn text={credentialsModal.credentials.username} />
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Temporary Password</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-amber-700 dark:text-amber-400 font-bold">
                      {credentialsModal.credentials.password}
                    </code>
                    <CopyBtn text={credentialsModal.credentials.password} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                The parent will be prompted to change their password on first login.
              </p>
              <Button onClick={() => setCredentialsModal(null)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── PARENT DETAIL DIALOG ──────────────────────────────────────────────── */}
      <Dialog open={!!detailParent} onOpenChange={open => { if (!open) setDetailParent(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Eye className="h-5 w-5 text-violet-600" />
              Parent Details
            </DialogTitle>
          </DialogHeader>
          {detailParent && (
            <div className="space-y-4 pt-2">
              {/* Profile */}
              <div className="flex items-center gap-4 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-2xl border border-violet-100 dark:border-violet-800">
                <div className="h-14 w-14 rounded-2xl bg-violet-200 dark:bg-violet-800 flex items-center justify-center text-lg font-bold text-violet-700 dark:text-violet-300">
                  {initials(detailParent)}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{detailParent.firstName} {detailParent.lastName}</p>
                  <p className="text-xs text-gray-500 font-mono">{detailParent.username}</p>
                  <Badge
                    variant="outline"
                    className={`mt-1 text-[10px] ${detailParent.isActive && detailParent.status !== 'suspended' ? 'border-emerald-300 text-emerald-700' : 'border-gray-300 text-gray-500'}`}
                  >
                    {detailParent.isActive && detailParent.status !== 'suspended' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact Information</p>
                {detailParent.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {detailParent.phone}
                  </div>
                )}
                {detailParent.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {detailParent.email}
                  </div>
                )}
                {!detailParent.phone && !detailParent.email && (
                  <p className="text-sm text-gray-400 italic">No contact information provided</p>
                )}
              </div>

              {/* Linked students */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Linked Students ({detailParent.linkedStudents.length})
                </p>
                {detailParent.linkedStudents.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-2">No students linked to this parent.</p>
                ) : (
                  <div className="space-y-2">
                    {detailParent.linkedStudents.map(s => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"
                        data-testid={`detail-student-${s.id}`}
                      >
                        <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{s.firstName} {s.lastName}</p>
                          <p className="text-xs text-gray-400 truncate">{s.className} · {s.admissionNumber}</p>
                        </div>
                        <button
                          onClick={() => unlinkMutation.mutate({ parentId: detailParent.id, studentId: s.id })}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                          title="Unlink student"
                          data-testid={`button-unlink-${s.id}`}
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={() => { setLinkMoreParent(detailParent); setDetailParent(null); setLinkMoreSelected([]); }}
                variant="outline"
                className="w-full rounded-xl gap-2 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400"
              >
                <Link className="h-4 w-4" />
                Link More Students
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── EDIT PARENT DIALOG ────────────────────────────────────────────────── */}
      <Dialog open={!!editParent} onOpenChange={open => { if (!open) setEditParent(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Edit2 className="h-4 w-4 text-blue-600" />
              Edit Parent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Profile Completion Status */}
            {editParent && (() => {
              const completion = computeProfileCompletion({
                profileImageUrl: (editParent as any).profileImageUrl,
                phone: editParent.phone,
                email: editParent.email,
                address: (editParent as any).address,
              });
              if (completion.isComplete) return (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-300 font-medium">Profile 100% complete</span>
                </div>
              );
              return (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                      Profile {completion.percentage}% complete
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-amber-100 dark:bg-amber-900/50 rounded-full mb-2">
                    <div className="h-1.5 bg-amber-500 rounded-full" style={{ width: `${completion.percentage}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {completion.missingFields.map(f => (
                      <span key={f.key} className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-700">
                        {f.label} missing
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">First Name</Label>
                <Input
                  value={editForm.firstName}
                  onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))}
                  className="rounded-xl"
                  data-testid="input-edit-first-name"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Last Name</Label>
                <Input
                  value={editForm.lastName}
                  onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                  className="rounded-xl"
                  data-testid="input-edit-last-name"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Phone</Label>
              <Input
                value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                className="rounded-xl"
                data-testid="input-edit-phone"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                className="rounded-xl"
                data-testid="input-edit-email"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditParent(null)} className="flex-1 rounded-xl">Cancel</Button>
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                data-testid="button-save-edit"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── LINK MORE STUDENTS DIALOG ─────────────────────────────────────────── */}
      <Dialog open={!!linkMoreParent} onOpenChange={open => { if (!open) { setLinkMoreParent(null); setLinkMoreSelected([]); } }}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Link className="h-4 w-4 text-violet-600" />
              Link Students to {linkMoreParent?.firstName} {linkMoreParent?.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <StudentSearch
              selectedStudents={linkMoreSelected}
              onSelect={s => setLinkMoreSelected(prev => [...prev, s])}
              onRemove={id => setLinkMoreSelected(prev => prev.filter(s => s.id !== id))}
              excludeIds={linkMoreParent?.linkedStudents.map(s => s.id) ?? []}
            />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => { setLinkMoreParent(null); setLinkMoreSelected([]); }} className="flex-1 rounded-xl">Cancel</Button>
              <Button
                onClick={() => linkMutation.mutate({ parentId: linkMoreParent!.id, studentIds: linkMoreSelected.map(s => s.id) })}
                disabled={linkMoreSelected.length === 0 || linkMutation.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2"
                data-testid="button-confirm-link"
              >
                <Link className="h-4 w-4" />
                {linkMutation.isPending ? 'Linking...' : `Link ${linkMoreSelected.length} Student${linkMoreSelected.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM DIALOG ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Parent Account
            </DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete the account for{' '}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {deleteConfirm?.firstName} {deleteConfirm?.lastName}
              </span>?
              This will also unlink all their students.
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-xl">Cancel</Button>
              <Button
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
