import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  User, Mail, Phone, Shield, Calendar, Users, UserCircle
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

interface ParentProfileData {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    phone: string | null;
    profileImageUrl: string | null;
    status: string;
    createdAt: string;
  };
  profile: {
    occupation: string | null;
    address: string | null;
  } | null;
}

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  className: string | null;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="p-2 bg-muted rounded-lg flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium mt-0.5">{value || <span className="text-muted-foreground italic">Not provided</span>}</p>
      </div>
    </div>
  );
}

function formatJoinDate(dateStr: string | undefined) {
  if (!dateStr) return 'Unknown';
  try {
    const d = parseISO(dateStr);
    if (isValid(d)) return format(d, 'MMMM d, yyyy');
  } catch {}
  return dateStr;
}

export default function ParentProfile() {
  const { user: authUser } = useAuth();

  const { data: profileData, isLoading: loadingProfile } = useQuery<ParentProfileData>({
    queryKey: ['/api/parent/profile'],
    enabled: !!authUser,
  });

  const { data: children = [], isLoading: loadingChildren } = useQuery<Child[]>({
    queryKey: ['/api/parent/children'],
    enabled: !!authUser,
  });

  const user = profileData?.user;
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '??';

  if (loadingProfile) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-parent-profile">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCircle className="h-6 w-6 text-primary" />
          My Profile
        </h1>
        <p className="text-muted-foreground mt-1">Your account information and linked children</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 p-8 text-center">
            <Avatar className="h-24 w-24 mx-auto border-4 border-white/30 shadow-xl">
              <AvatarImage src={user?.profileImageUrl ?? undefined} />
              <AvatarFallback className="bg-white/20 text-white text-3xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold text-white mt-4" data-testid="text-profile-name">
              {user ? `${user.firstName} ${user.lastName}` : '—'}
            </h2>
            <p className="text-white/80 text-sm mt-1">Parent Account</p>
          </div>
          <CardContent className="p-5 space-y-3 text-center">
            <Badge
              className={user?.status === 'active'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0'
                : 'bg-gray-100 text-gray-700 border-0'}
            >
              {user?.status === 'active' ? 'Active' : user?.status ?? 'Unknown'}
            </Badge>
            <p className="text-xs text-muted-foreground">
              Member since {formatJoinDate(user?.createdAt)}
            </p>
            <Separator />
            <div className="flex items-center justify-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {loadingChildren ? '...' : `${children.length} ${children.length === 1 ? 'child' : 'children'} linked`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <InfoRow icon={User} label="Full Name" value={user ? `${user.firstName} ${user.lastName}` : undefined} />
              <InfoRow icon={Mail} label="Email Address" value={user?.email} />
              <InfoRow icon={User} label="Username" value={user?.username} />
              <InfoRow icon={Phone} label="Phone Number" value={user?.phone} />
              <InfoRow icon={Calendar} label="Member Since" value={formatJoinDate(user?.createdAt)} />
            </CardContent>
          </Card>

          {/* Children Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                My Children
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingChildren ? (
                <div className="p-4 space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : children.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No children linked to your account</p>
                  <p className="text-xs mt-1">Contact the school administration for assistance</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {children.map((child) => {
                    const ci = `${child.firstName[0] ?? ''}${child.lastName[0] ?? ''}`.toUpperCase();
                    return (
                      <div key={child.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30" data-testid={`profile-child-${child.id}`}>
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                            {ci}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{child.firstName} {child.lastName}</p>
                          <p className="text-xs text-muted-foreground">{child.admissionNumber} • {child.className ?? 'No class assigned'}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">Student</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
