import { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft, CircleAlert } from 'lucide-react';
import { ROLE_IDS } from '@/lib/roles';
import { useAuth } from '@/lib/auth';
import { useProfileCompletion } from '@/hooks/useProfileCompletion';

interface RequireCompleteProfileProps {
  children: ReactNode;
  feature?: string;
}

export default function RequireCompleteProfile({
  children,
  feature = "this feature",
}: RequireCompleteProfileProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const isTeacher = user?.roleId === ROLE_IDS.TEACHER;

  const { data: teacherStatus, isLoading: teacherLoading } = useQuery({
    queryKey: ['/api/teacher/profile/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/teacher/profile/status');
      return response.json();
    },
    enabled: !!user && isTeacher,
    staleTime: 0,
  });

  const studentCompletion = useProfileCompletion();

  const isLoading = isTeacher
    ? teacherLoading
    : studentCompletion.isLoading && studentCompletion.percentage === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isProfileComplete = isTeacher
    ? teacherStatus?.profileCompleted
    : studentCompletion.isComplete;

  if (isProfileComplete) {
    return <>{children}</>;
  }

  const displayPercentage = isTeacher
    ? teacherStatus?.percentage
    : studentCompletion.percentage;

  const profilePath = isTeacher ? '/portal/teacher/profile' : '/portal/student/profile';
  const dashboardPath = isTeacher ? '/portal/teacher' : '/portal/student';

  return (
    <div className="container mx-auto px-4 py-10 max-w-md" data-testid="profile-required-gate">
      <div className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-muted p-2 flex-shrink-0 mt-0.5">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground leading-snug">
              Profile Required
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              You need to complete your profile to access {feature}.
            </p>
          </div>
        </div>

        {displayPercentage > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <CircleAlert className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Your profile is <span className="font-semibold text-foreground">{displayPercentage}% complete</span>
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => navigate(profilePath)}
            className="flex-1"
            data-testid="button-goto-profile"
          >
            Complete Profile
          </Button>
          <Button
            onClick={() => navigate(dashboardPath)}
            variant="outline"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
