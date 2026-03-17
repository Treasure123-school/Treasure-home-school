
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Key, Mail, AlertCircle, CheckCircle, UserCog, Trash2, RotateCcw, Clock, Users, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format, formatDistanceToNow } from 'date-fns';

interface DeletedUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roleName: string;
  roleId: number;
  deletedAt: string;
  deletedBy: string | null;
  daysRemaining: number;
  expiresAt: string;
  admissionNumber?: string;
  className?: string;
}

export default function AdminRecoveryTools() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.roleId === 1;
  
  const [resetUserId, setResetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forceChange, setForceChange] = useState(true);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryUserId, setRecoveryUserId] = useState('');

  // Fetch deleted users
  const { data: deletedUsers = [], isLoading: loadingDeletedUsers, refetch: refetchDeletedUsers } = useQuery<DeletedUser[]>({
    queryKey: ['/api/recovery/deleted-users'],
  });

  // Restore user mutation
  const restoreUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest('POST', `/api/recovery/restore/${userId}`);
    },
    onSuccess: (data: any) => {
      toast({
        title: 'User Restored',
        description: `${data.user?.firstName || 'User'} has been restored successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/recovery/deleted-users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Restore Failed',
        description: error.message || 'Failed to restore user',
        variant: 'destructive',
      });
    },
  });

  // Permanent delete mutation
  const permanentDeleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest('DELETE', `/api/recovery/permanent/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: 'User Permanently Deleted',
        description: 'User and all associated data have been permanently removed.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/recovery/deleted-users'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to permanently delete user',
        variant: 'destructive',
      });
    },
  });

  // Password reset mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; newPassword: string; forceChange: boolean }) => {
      const response = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to reset password');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Password Reset Successful',
        description: 'User password has been reset. They will receive an email notification.',
      });
      setResetUserId('');
      setNewPassword('');
      queryClient.invalidateQueries({ queryKey: ['/api/audit-logs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Password Reset Failed',
        description: error.message || 'Failed to reset password. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Recovery email update mutation
  const updateRecoveryEmailMutation = useMutation({
    mutationFn: async (data: { userId: string; recoveryEmail: string }) => {
      const response = await fetch('/api/admin/update-recovery-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update recovery email');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Recovery Email Updated',
        description: 'User recovery email has been updated successfully.',
      });
      setRecoveryUserId('');
      setRecoveryEmail('');
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update recovery email.',
        variant: 'destructive',
      });
    },
  });

  // Delete demo accounts mutation
  const deleteDemoAccountsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/delete-demo-accounts');
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Demo Accounts Deleted',
        description: `Successfully deleted ${data.deletedUsers?.length || 0} demo accounts`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete demo accounts',
        variant: 'destructive',
      });
    },
  });

  const handleResetPassword = () => {
    if (!resetUserId || !newPassword) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both user ID and new password.',
        variant: 'destructive',
      });
      return;
    }
    resetPasswordMutation.mutate({ userId: resetUserId, newPassword, forceChange });
  };

  const handleUpdateRecoveryEmail = () => {
    if (!recoveryUserId || !recoveryEmail) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both user ID and recovery email.',
        variant: 'destructive',
      });
      return;
    }
    updateRecoveryEmailMutation.mutate({ userId: recoveryUserId, recoveryEmail });
  };

  const handleDeleteDemoAccounts = () => {
    if (window.confirm('Are you sure you want to delete all demo accounts (admin@demo.com, teacher@demo.com, admin@treasure.com)? This action cannot be undone and will remove all their data.')) {
      deleteDemoAccountsMutation.mutate();
    }
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'Student': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Teacher': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Parent': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Admin': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Admin Recovery Tools
              </h2>
              <p className="text-red-100 text-sm">Master recovery powers for account management</p>
            </div>
          </div>
        </div>

        <Card className="border-2 border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  High-Security Zone
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  These tools provide master access to user accounts. All actions are logged in the audit trail. Use responsibly and only when necessary.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="deleted-users" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deleted-users" className="flex items-center gap-2" data-testid="tab-deleted-users">
              <Users className="h-4 w-4" />
              Deleted Users
            </TabsTrigger>
            <TabsTrigger value="password-recovery" className="flex items-center gap-2" data-testid="tab-password-recovery">
              <Key className="h-4 w-4" />
              Password Recovery
            </TabsTrigger>
            <TabsTrigger value="utilities" className="flex items-center gap-2" data-testid="tab-utilities">
              <UserCog className="h-4 w-4" />
              Utilities
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deleted-users" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-blue-600" />
                    Recover Deleted Users
                  </CardTitle>
                  <CardDescription>
                    View and restore recently deleted users. Users are permanently deleted after the retention period expires.
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchDeletedUsers()}
                  data-testid="button-refresh-deleted-users"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {loadingDeletedUsers ? (
                  <div className="text-center py-8 text-muted-foreground">Loading deleted users...</div>
                ) : deletedUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="text-muted-foreground">No deleted users found</p>
                    <p className="text-sm text-muted-foreground mt-1">All users are currently active</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Deleted</TableHead>
                          <TableHead>Time Remaining</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedUsers.map((deletedUser) => (
                          <TableRow key={deletedUser.id} data-testid={`row-deleted-user-${deletedUser.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{deletedUser.firstName} {deletedUser.lastName}</p>
                                <p className="text-sm text-muted-foreground">{deletedUser.username || deletedUser.email}</p>
                                {deletedUser.admissionNumber && (
                                  <p className="text-xs text-muted-foreground">{deletedUser.admissionNumber}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getRoleBadgeColor(deletedUser.roleName)}>
                                {deletedUser.roleName}
                              </Badge>
                              {deletedUser.className && (
                                <p className="text-xs text-muted-foreground mt-1">{deletedUser.className}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(deletedUser.deletedAt), { addSuffix: true })}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(deletedUser.deletedAt), 'MMM d, yyyy')}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={deletedUser.daysRemaining <= 7 ? 'destructive' : 'secondary'}
                              >
                                {deletedUser.daysRemaining} days left
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => restoreUserMutation.mutate(deletedUser.id)}
                                  disabled={restoreUserMutation.isPending}
                                  data-testid={`button-restore-${deletedUser.id}`}
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Restore
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={permanentDeleteMutation.isPending}
                                      data-testid={`button-permanent-delete-${deletedUser.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Permanently Delete User?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete{' '}
                                        <strong>{deletedUser.firstName} {deletedUser.lastName}</strong> and all their associated data including:
                                        <ul className="list-disc ml-6 mt-2">
                                          <li>Exam sessions and results</li>
                                          <li>Attendance records</li>
                                          <li>Report cards</li>
                                          <li>All other related data</li>
                                        </ul>
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => permanentDeleteMutation.mutate(deletedUser.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete Permanently
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password-recovery" className="space-y-4 mt-4">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-blue-600" />
                    Reset User Password
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="reset-user-id">User ID or Username</Label>
                    <Input
                      id="reset-user-id"
                      value={resetUserId}
                      onChange={(e) => setResetUserId(e.target.value)}
                      placeholder="Enter user ID or username"
                      data-testid="input-reset-user-id"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter strong password (min 8 characters)"
                      data-testid="input-new-password"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Password must be at least 8 characters with uppercase, lowercase, numbers, and symbols
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span><strong>Security Policy:</strong> Users will be required to change this password on next login.</span>
                    </p>
                  </div>
                  <Button
                    onClick={handleResetPassword}
                    disabled={resetPasswordMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    data-testid="button-reset-password"
                  >
                    {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-green-600" />
                    Update Recovery Email
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="recovery-user-id">User ID or Username</Label>
                    <Input
                      id="recovery-user-id"
                      value={recoveryUserId}
                      onChange={(e) => setRecoveryUserId(e.target.value)}
                      placeholder="Enter user ID or username"
                      data-testid="input-recovery-user-id"
                    />
                  </div>
                  <div>
                    <Label htmlFor="recovery-email">Recovery Email Address</Label>
                    <Input
                      id="recovery-email"
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="parent@example.com"
                      data-testid="input-recovery-email"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      For students: parent/guardian email. For staff: alternate contact.
                    </p>
                  </div>
                  <Button
                    onClick={handleUpdateRecoveryEmail}
                    disabled={updateRecoveryEmailMutation.isPending}
                    className="w-full bg-green-600 hover:bg-green-700"
                    data-testid="button-update-recovery-email"
                  >
                    {updateRecoveryEmailMutation.isPending ? 'Updating...' : 'Update Recovery Email'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="utilities" className="space-y-4 mt-4">
            <Card className="border-2 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-200">
                  <Trash2 className="h-5 w-5 text-orange-600" />
                  Delete Demo Accounts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      This will permanently delete the following demo accounts and all their associated data:
                    </p>
                    <ul className="text-sm text-orange-700 dark:text-orange-300 ml-4 mt-2 list-disc">
                      <li>admin@demo.com</li>
                      <li>teacher@demo.com</li>
                      <li>admin@treasure.com</li>
                    </ul>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
                      <strong>Warning:</strong> This action cannot be undone. All exams, announcements, and related data will be removed.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleDeleteDemoAccounts}
                  disabled={deleteDemoAccountsMutation.isPending}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  data-testid="button-delete-demo-accounts"
                >
                  {deleteDemoAccountsMutation.isPending ? 'Deleting...' : 'Delete Demo Accounts'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  Recovery Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Password Reset:</strong> Always enable "Force password change" for security. User will be notified via email.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Recovery Email:</strong> Must be a valid, accessible email for password reset links.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Deleted Users:</strong> Can be restored within the retention period. After that, they are permanently deleted.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Audit Trail:</strong> All recovery actions are logged with your admin ID and timestamp.</span>
                  </li>
                  {isSuperAdmin && (
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Retention Period:</strong> Super Admins can configure the retention period in System Settings.</span>
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
