import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Users, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface ProfileUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  profileCompleted: boolean;
  completionPercentage: number;
  lastLogin: string | null;
}
export default function ProfileCompletionMonitoring() {
  const { data: users, isLoading } = useQuery<ProfileUser[]>({
    queryKey: ["/api/admin/profile-completion"],
  });

  const getStatusBadge = (percentage: number) => {
    if (percentage === 100) {
      return <Badge className="bg-green-600" data-testid={`badge-complete`}>Complete</Badge>;
    } else if (percentage >= 50) {
      return <Badge className="bg-yellow-600" data-testid={`badge-in-progress`}>In Progress</Badge>;
    } else {
      return <Badge variant="destructive" data-testid={`badge-incomplete`}>Incomplete</Badge>;
    }
  };

  const completedCount = users ? users.filter((u) => u.profileCompleted).length : 0;
  const totalCount = users ? users.length : 0;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile Completion Monitoring</h1>
        <p className="text-muted-foreground">Monitor user profile completion status across the system</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">{totalCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Profiles</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-completed-count">{completedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completion-rate">{completionRate}%</div>
            <Progress value={completionRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* User Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Profile Status</CardTitle>
          <CardDescription>View detailed profile completion status for all users</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead>Last Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users && users.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell className="font-medium" data-testid={`text-name-${user.id}`}>{user.name}</TableCell>
                  <TableCell data-testid={`text-email-${user.id}`}>{user.email}</TableCell>
                  <TableCell data-testid={`text-role-${user.id}`}>{user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'default' : 'secondary'} data-testid={`badge-status-${user.id}`}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(user.completionPercentage)}
                      <span className="text-sm text-muted-foreground" data-testid={`text-percentage-${user.id}`}>
                        {user.completionPercentage}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-lastLogin-${user.id}`}>
                    {user.lastLogin ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {new Date(user.lastLogin).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
