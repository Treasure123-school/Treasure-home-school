import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { 
  User, 
  GraduationCap, 
  Calendar,
  BookOpen,
  MapPin,
  Clock,
  Mail,
  Phone,
  Briefcase,
  Award,
  Edit
} from 'lucide-react';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface TimetableEntry {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  className: string;
  subjectName: string;
  location: string | null;
}
interface Assignment {
  id: number;
  className: string;
  subjectName: string;
  subjectCode: string;
  classLevel: string;
  termName?: string;
}
interface TeacherProfile {
  department?: string;
  qualification?: string;
  yearsOfExperience?: number;
  staffId?: string;
}
interface UserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
}
interface DashboardData {
  profile?: TeacherProfile;
  user?: UserData;
  assignments: Assignment[];
  timetable: TimetableEntry[];
}
export default function TeacherProfileAssignmentDashboard() {
  const { user } = useAuth();

  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['/api/teacher/dashboard'],
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to view this page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-destructive">
          <p>Error loading dashboard. Please try again.</p>
        </div>
      </div>
    );
  }
  const { profile, user: userData, assignments = [], timetable = [] } = dashboardData || {};

  const groupedTimetable: Record<string, TimetableEntry[]> = {};
  DAYS_OF_WEEK.forEach(day => {
    groupedTimetable[day] = timetable.filter((entry: TimetableEntry) => entry.dayOfWeek === day);
  });

  return (
    <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
              Teacher Profile & Assignments
            </h1>
            <p className="text-muted-foreground mt-1">
              View your profile, teaching schedule, and class assignments
            </p>
          </div>
        </div>

        {/* 1️⃣ Personal Profile Section */}
        <Card data-testid="card-profile">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <User className="h-5 w-5" />
                Personal Profile
              </CardTitle>
              <Button variant="outline" size="sm" asChild data-testid="button-edit-profile">
                <Link href="/portal/teacher/profile">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {userData?.profileImageUrl ? (
                    <img
                      src={userData.profileImageUrl}
                      alt="Profile"
                      className="h-20 w-20 rounded-full object-cover border-2 border-primary"
                      data-testid="img-profile-picture"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary">
                      <User className="h-10 w-10 text-primary" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-semibold" data-testid="text-full-name">
                      {userData?.firstName} {userData?.lastName}
                    </h3>
                    <p className="text-sm text-muted-foreground">Teacher</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span data-testid="text-email">{userData?.email || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span data-testid="text-phone">{userData?.phone || 'Not provided'}</span>
                  </div>
                  {profile?.staffId && (
                    <div className="flex items-center gap-3 text-sm">
                      <Badge variant="outline" data-testid="badge-staff-id">
                        Staff ID: {profile.staffId}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Professional Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Department</span>
                    </div>
                    <p className="text-base" data-testid="text-department">
                      {profile?.department || 'Not specified'}
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Qualification</span>
                    </div>
                    <p className="text-base" data-testid="text-qualification">
                      {profile?.qualification || 'Not specified'}
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Experience</span>
                    </div>
                    <p className="text-base" data-testid="text-experience">
                      {profile?.yearsOfExperience || 0} years
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2️⃣ Weekly Timetable Section */}
        <Card data-testid="card-timetable">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar className="h-5 w-5" />
              Weekly Timetable
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timetable.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p data-testid="text-no-timetable">
                  No timetable entries found. Your schedule will appear here once assigned by the admin.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-full space-y-4">
                  {DAYS_OF_WEEK.map((day, dayIndex) => {
                    const daySlots = groupedTimetable[day] || [];
                    return (
                      <div
                        key={day}
                        className="border rounded-lg p-4"
                        data-testid={`timetable-day-${dayIndex}`}
                      >
                        <h4 className="font-semibold mb-3 text-lg flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-primary"></div>
                          {day}
                        </h4>
                        {daySlots.length === 0 ? (
                          <p className="text-sm text-muted-foreground ml-5">No classes scheduled</p>
                        ) : (
                          <div className="grid gap-2 ml-5">
                            {daySlots.map((slot: TimetableEntry, slotIndex: number) => (
                              <div
                                key={slot.id}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                                data-testid={`timetable-slot-${dayIndex}-${slotIndex}`}
                              >
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="flex items-center gap-2 min-w-[100px]">
                                    <Clock className="h-4 w-4 text-primary" />
                                    <span className="font-medium text-sm" data-testid={`text-time-${dayIndex}-${slotIndex}`}>
                                      {slot.startTime} - {slot.endTime}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium" data-testid={`text-subject-${dayIndex}-${slotIndex}`}>
                                      {slot.subjectName}
                                    </span>
                                  </div>
                                  <Badge variant="secondary" data-testid={`badge-class-${dayIndex}-${slotIndex}`}>
                                    {slot.className}
                                  </Badge>
                                </div>
                                {slot.location && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    <span data-testid={`text-location-${dayIndex}-${slotIndex}`}>
                                      {slot.location}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3️⃣ Assigned Classes & Subjects Section */}
        <Card data-testid="card-assignments">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5" />
              Assigned Classes & Subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p data-testid="text-no-assignments">
                  No class assignments found. Your teaching assignments will appear here once configured by the admin.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignments.map((assignment: Assignment, index: number) => (
                  <div
                    key={assignment.id}
                    className="p-4 border rounded-lg hover:border-primary/50 hover:shadow-md transition-all"
                    data-testid={`card-assignment-${index}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <GraduationCap className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-lg" data-testid={`text-class-name-${index}`}>
                            {assignment.className}
                          </h4>
                        </div>
                        <Badge variant="outline" className="text-xs" data-testid={`badge-class-level-${index}`}>
                          {assignment.classLevel}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium" data-testid={`text-subject-name-${index}`}>
                            {assignment.subjectName}
                          </p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-subject-code-${index}`}>
                            Code: {assignment.subjectCode}
                          </p>
                        </div>
                      </div>

                      {assignment.termName && (
                        <div className="pt-2 mt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            Term: <span className="font-medium" data-testid={`text-term-${index}`}>{assignment.termName}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
