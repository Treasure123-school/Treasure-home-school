import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar, CheckCircle, XCircle, Clock, AlertCircle, GraduationCap, Users
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  className: string | null;
}

interface AttendanceRecord {
  id: number;
  date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  notes: string | null;
}

interface AttendanceData {
  records: AttendanceRecord[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number;
  };
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string; bg: string }> = {
  Present: { label: 'Present', icon: CheckCircle, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/40' },
  Absent: { label: 'Absent', icon: XCircle, color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
  Late: { label: 'Late', icon: Clock, color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  Excused: { label: 'Excused', icon: AlertCircle, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
};

function formatDate(dateStr: string) {
  try {
    const d = parseISO(dateStr);
    if (isValid(d)) return format(d, 'EEE, MMM d, yyyy');
  } catch {}
  return dateStr;
}

export default function ParentAttendance() {
  const { user } = useAuth();
  const [selectedChild, setSelectedChild] = useState<string>('');

  const { data: children = [], isLoading: loadingChildren } = useQuery<Child[]>({
    queryKey: ['/api/parent/children'],
    enabled: !!user,
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChild) {
      setSelectedChild(children[0].id);
    }
  }, [children, selectedChild]);

  const { data: attendanceData, isLoading: loadingAttendance } = useQuery<AttendanceData>({
    queryKey: ['/api/parent/attendance', selectedChild],
    queryFn: async () => {
      const res = await fetch(`/api/parent/attendance/${selectedChild}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch attendance');
      return res.json();
    },
    enabled: !!selectedChild,
  });

  const child = children.find(c => c.id === selectedChild);

  return (
    <div className="space-y-6" data-testid="page-parent-attendance">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Attendance Records
          </h1>
          <p className="text-muted-foreground mt-1">Track your child's school attendance</p>
        </div>

        {children.length > 0 && (
          <div className="w-full sm:w-64">
            <Select value={selectedChild} onValueChange={setSelectedChild} data-testid="select-child">
              <SelectTrigger>
                <SelectValue placeholder="Select a child" />
              </SelectTrigger>
              <SelectContent>
                {children.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>{c.firstName} {c.lastName}</span>
                      {c.className && <span className="text-xs text-muted-foreground">({c.className})</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loadingChildren && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      {!loadingChildren && children.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold mb-2">No Children Linked</h3>
            <p className="text-sm text-muted-foreground">Please contact the school administration to link your children.</p>
          </CardContent>
        </Card>
      )}

      {selectedChild && !loadingAttendance && attendanceData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: 'present', label: 'Present', value: attendanceData.summary.present, icon: CheckCircle, color: 'from-green-500 to-emerald-600' },
              { key: 'absent', label: 'Absent', value: attendanceData.summary.absent, icon: XCircle, color: 'from-red-500 to-rose-600' },
              { key: 'late', label: 'Late', value: attendanceData.summary.late, icon: Clock, color: 'from-yellow-500 to-amber-600' },
              { key: 'excused', label: 'Excused', value: attendanceData.summary.excused, icon: AlertCircle, color: 'from-blue-500 to-indigo-600' },
            ].map(({ key, label, value, icon: Icon, color }) => (
              <Card key={key} className="overflow-hidden border-none shadow-lg" data-testid={`stat-${key}`}>
                <div className={`bg-gradient-to-br ${color} p-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-xs font-medium">{label}</p>
                      <p className="text-3xl font-bold mt-1">{value}</p>
                      <p className="text-white/70 text-xs mt-1">{attendanceData.summary.total} total days</p>
                    </div>
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Attendance Rate Banner */}
          <Card className="border border-border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Attendance Rate</p>
                  <p className="text-4xl font-bold text-primary mt-1" data-testid="text-attendance-rate">
                    {attendanceData.summary.rate}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {child?.firstName} {child?.lastName} • {child?.className ?? 'N/A'}
                  </p>
                </div>
                <div className="flex gap-3">
                  {attendanceData.summary.rate >= 80 ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm px-3 py-1">
                      Excellent
                    </Badge>
                  ) : attendanceData.summary.rate >= 60 ? (
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-sm px-3 py-1">
                      Needs Improvement
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-sm px-3 py-1">
                      Critical
                    </Badge>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700"
                    style={{ width: `${attendanceData.summary.rate}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Records Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Attendance History
                <Badge variant="secondary" className="ml-auto">
                  {attendanceData.records.length} records
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {attendanceData.records.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No attendance records found</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {attendanceData.records.map((record) => {
                    const config = statusConfig[record.status] ?? statusConfig.Present;
                    const Icon = config.icon;
                    return (
                      <div key={record.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors" data-testid={`attendance-row-${record.id}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${config.bg}`}>
                            <Icon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{formatDate(record.date)}</p>
                            {record.notes && <p className="text-xs text-muted-foreground">{record.notes}</p>}
                          </div>
                        </div>
                        <Badge className={`${config.bg} ${config.color} border-0 text-xs`}>
                          {record.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {selectedChild && loadingAttendance && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}
    </div>
  );
}
