import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, GraduationCap, Hash, Calendar, BookOpen, Bell,
  TrendingUp, CheckCircle, XCircle, Clock, AlertCircle
} from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classId: number | null;
  className: string | null;
  department: string | null;
  admissionDate: string;
  email: string;
  profileImageUrl: string | null;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
}

function ChildCard({ child }: { child: Child }) {
  const initials = `${child.firstName[0] ?? ''}${child.lastName[0] ?? ''}`.toUpperCase();

  const { data: attendance } = useQuery<{ summary: AttendanceSummary }>({
    queryKey: ['/api/parent/attendance', child.id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/parent/attendance/${child.id}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: grades = [] } = useQuery<any[]>({
    queryKey: ['/api/parent/grades', child.id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/parent/grades/${child.id}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const avgScore = grades.length > 0
    ? Math.round(grades.reduce((sum: number, g: any) => sum + (g.percentage ?? 0), 0) / grades.length)
    : null;

  return (
    <Card className="overflow-hidden border border-border hover:shadow-lg transition-all duration-300" data-testid={`child-card-${child.id}`}>
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-white/30">
            <AvatarImage src={child.profileImageUrl ?? undefined} />
            <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-xl font-bold text-white" data-testid={`text-child-name-${child.id}`}>
              {child.firstName} {child.lastName}
            </h3>
            <p className="text-blue-100 text-sm">{child.email}</p>
          </div>
        </div>
      </div>

      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Admission No.</p>
              <p className="font-medium" data-testid={`text-child-admission-${child.id}`}>{child.admissionNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Class</p>
              <p className="font-medium" data-testid={`text-child-class-${child.id}`}>{child.className ?? 'Not Assigned'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Admission Date</p>
              <p className="font-medium">{child.admissionDate}</p>
            </div>
          </div>
          {child.department && (
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="font-medium">{child.department}</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4 grid grid-cols-2 gap-3">
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Attendance Rate</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid={`text-child-attendance-${child.id}`}>
              {attendance ? `${attendance.summary.rate}%` : '—'}
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Avg. Score</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid={`text-child-score-${child.id}`}>
              {avgScore !== null ? `${avgScore}%` : '—'}
            </p>
          </div>
        </div>

        {attendance && (
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { label: 'Present', value: attendance.summary.present, icon: CheckCircle, color: 'text-green-600' },
              { label: 'Absent', value: attendance.summary.absent, icon: XCircle, color: 'text-red-500' },
              { label: 'Late', value: attendance.summary.late, icon: Clock, color: 'text-yellow-600' },
              { label: 'Excused', value: attendance.summary.excused, icon: AlertCircle, color: 'text-blue-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-muted/30 rounded p-2">
                <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
                <p className={`font-bold ${color}`}>{value}</p>
                <p className="text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/portal/parent/attendance" data-testid={`button-attendance-${child.id}`}>
              <Calendar className="h-4 w-4 mr-1" />
              Attendance
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/portal/parent/grades" data-testid={`button-grades-${child.id}`}>
              <TrendingUp className="h-4 w-4 mr-1" />
              Grades
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/portal/parent/reports" data-testid={`button-reports-${child.id}`}>
              <BookOpen className="h-4 w-4 mr-1" />
              Reports
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ParentChildren() {
  const { user } = useAuth();

  const { data: children = [], isLoading } = useQuery<Child[]>({
    queryKey: ['/api/parent/children'],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => <Skeleton key={i} className="h-80 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-parent-children">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          My Children
        </h1>
        <p className="text-muted-foreground mt-1">
          Overview of all your children's academic profiles
        </p>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Children Linked</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Your account has not been linked to any student records yet.
              Please contact the school administration.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {children.length} {children.length === 1 ? 'child' : 'children'} enrolled
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {children.map((child) => (
              <ChildCard key={child.id} child={child} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
