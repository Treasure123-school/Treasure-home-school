import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, BookOpen, ChevronRight, GraduationCap, ClipboardList } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface TeacherClass {
  id: number;
  name: string;
  level: string;
  capacity?: number;
  studentCount: number;
  subjects: { id: number; name: string }[];
}

export default function TeacherClasses() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: classes = [], isLoading } = useQuery<TeacherClass[]>({
    queryKey: ['/api/teacher/my-classes'],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="heading-my-classes">My Classes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome, {user?.firstName}. You are assigned to {classes.length} class{classes.length !== 1 ? 'es' : ''}.
        </p>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No classes assigned</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              You haven't been assigned to any classes yet. Contact your administrator to get assigned.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card
              key={cls.id}
              className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-200 group"
              onClick={() => navigate(`/portal/teacher/classes/${cls.id}`)}
              data-testid={`card-class-${cls.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-bold leading-tight" data-testid={`text-class-name-${cls.id}`}>
                      {cls.name}
                    </CardTitle>
                    {cls.level && (
                      <p className="text-xs text-muted-foreground mt-0.5">{cls.level}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <span data-testid={`text-student-count-${cls.id}`}>
                    {cls.studentCount} student{cls.studentCount !== 1 ? 's' : ''}
                    {cls.capacity ? ` / ${cls.capacity} capacity` : ''}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <BookOpen className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {cls.subjects.length > 0 ? cls.subjects.map(s => (
                      <Badge key={s.id} variant="secondary" className="text-xs" data-testid={`badge-subject-${s.id}`}>
                        {s.name}
                      </Badge>
                    )) : (
                      <span className="text-xs italic">No subjects assigned</span>
                    )}
                  </div>
                </div>
                <div className="pt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={(e) => { e.stopPropagation(); navigate(`/portal/teacher/classes/${cls.id}`); }}
                    data-testid={`button-manage-class-${cls.id}`}
                  >
                    <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                    Manage Class
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
