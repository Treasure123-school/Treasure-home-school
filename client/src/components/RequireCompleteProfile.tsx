import { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ROLE_IDS } from '@/lib/roles';

interface RequireCompleteProfileProps {
  children: ReactNode;
  feature?: string;
}
interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: number;
  username?: string;
  role?: string;
  profileImageUrl?: string;
  profileCompleted?: boolean;
  profileCompletionPercentage?: number;
  profileSkipped?: boolean;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  recoveryEmail?: string;
}
interface AuthMeResponse {
  user: AuthUser;
}
export default function RequireCompleteProfile({ 
  children, 
  feature = "this feature" 
}: RequireCompleteProfileProps) {
  const [, navigate] = useLocation();
  const { data } = useQuery<AuthMeResponse>({ queryKey: ['/api/auth/me'] });
  const user = data?.user;

  // Determine which profile status endpoint to use based on role
  const isTeacher = user?.roleId === ROLE_IDS.TEACHER;
  const profileStatusEndpoint = isTeacher ? '/api/teacher/profile/status' : '/api/student/profile/status';

  // Check profile status
  const { data: profileStatus, isLoading } = useQuery({
    queryKey: [profileStatusEndpoint],
    queryFn: async () => {
      const response = await apiRequest('GET', profileStatusEndpoint);
      return await response.json();
    },
    enabled: !!user,
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  // If profile is complete, render children
  // For teachers: check profileCompleted, for students: check completed
  const isProfileComplete = isTeacher ? profileStatus?.profileCompleted : profileStatus?.completed;
  
  if (isProfileComplete) {
    return <>{children}</>;
  }
  // If profile is incomplete, show restriction message
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl" data-testid="profile-required-gate">
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <Lock className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold mb-2">
              Profile Completion Required
            </AlertTitle>
            <AlertDescription className="space-y-4">
              <p className="text-base">
                You need to complete your profile to access {feature}. This helps us provide you with the best experience and ensures all features work correctly.
              </p>
              
              <div className="bg-destructive/10 dark:bg-destructive/20 rounded-lg p-4 space-y-2">
                <p className="font-medium text-sm">Restricted Features:</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Taking exams and assessments</li>
                  <li>Viewing grades and report cards</li>
                  <li>Accessing study resources</li>
                  <li>Messaging teachers and students</li>
                  <li>Submitting assignments</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  onClick={() => navigate(isTeacher ? '/portal/teacher/profile' : '/portal/student/profile')}
                  className="flex-1"
                  data-testid="button-goto-profile"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Complete Profile Now
                </Button>
                <Button 
                  onClick={() => navigate(isTeacher ? '/portal/teacher' : '/portal/student')}
                  variant="outline"
                  data-testid="button-back-to-dashboard"
                >
                  Back to Dashboard
                </Button>
              </div>

              {profileStatus?.percentage > 0 && (
                <p className="text-sm text-center pt-2 text-muted-foreground">
                  Your profile is <strong>{profileStatus.percentage}%</strong> complete
                </p>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
