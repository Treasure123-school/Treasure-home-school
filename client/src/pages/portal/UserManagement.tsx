import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail, 
  ShieldCheck, 
  RotateCcw,
  MoreVertical,
  Trash2,
  KeyRound,
  UserCog,
  Shield,
  Users,
  Ban,
  Eye,
  EyeOff,
  Search,
  ShieldOff,
  Copy,
  Wand2,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRoleNameById } from "@/lib/roles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  roleId: number;
  roleName?: string;
  profileImageUrl: string | null;
  status: 'pending' | 'active' | 'suspended' | 'disabled';
  lastLoginAt?: Date | null;
}

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userToUnsuspend, setUserToUnsuspend] = useState<User | null>(null);

  // Reset password modal state
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
  const [resetForm, setResetForm] = useState<ResetPasswordForm>({ newPassword: '', confirmPassword: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forceChangeOnLogin, setForceChangeOnLogin] = useState(true);
  const [useAutoGenerate, setUseAutoGenerate] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<{ temporaryPassword?: string; message: string } | null>(null);

  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  useSocketIORealtime({ 
    table: 'users', 
    queryKey: ['/api/users']
  });

  const filteredUsers = allUsers.filter(u => {
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const searchLower = searchQuery.toLowerCase();
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    
    return matchesStatus && (
      fullName.includes(searchLower) ||
      u.email.toLowerCase().includes(searchLower) ||
      u.username?.toLowerCase().includes(searchLower)
    );
  });

  const counts = {
    all: allUsers.length,
    active: allUsers.filter(u => u.status === 'active').length,
    pending: allUsers.filter(u => u.status === 'pending').length,
    suspended: allUsers.filter(u => u.status === 'suspended').length,
    disabled: allUsers.filter(u => u.status === 'disabled').length,
  };

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => apiRequest('POST', `/api/users/${userId}/approve`),
    onSuccess: () => {
      toast({ title: "User Approved", description: "Account activated successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    }
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest('POST', `/api/users/${userId}/unsuspend`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to unsuspend user');
      }
      return res.json();
    },
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['/api/users'] });
      const previousUsers = queryClient.getQueryData<User[]>(['/api/users']);
      queryClient.setQueryData<User[]>(['/api/users'], (old = []) =>
        old.map(u => u.id === userId ? { ...u, status: 'active' as const } : u)
      );
      return { previousUsers };
    },
    onSuccess: (data) => {
      if (data?.user) {
        queryClient.setQueryData<User[]>(['/api/users'], (old = []) =>
          old.map(u => u.id === data.user.id ? { ...u, ...data.user } : u)
        );
      }
      toast({ title: "Account Unsuspended", description: "The user can now sign in again." });
    },
    onError: (error: Error, _, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['/api/users'], context.previousUsers);
      }
      toast({
        title: "Failed to Unsuspend",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword, forceChange }: { userId: string; newPassword?: string; forceChange: boolean }) => {
      const res = await apiRequest('POST', `/api/users/${userId}/reset-password`, {
        ...(newPassword ? { newPassword } : {}),
        forceChange,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to reset password');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResetSuccess({
        temporaryPassword: data.temporaryPassword,
        message: data.message,
      });
      setResetForm({ newPassword: '', confirmPassword: '' });
      setUseAutoGenerate(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Could not reset the password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConfirmUnsuspend = () => {
    if (userToUnsuspend) {
      unsuspendMutation.mutate(userToUnsuspend.id);
      setUserToUnsuspend(null);
    }
  };

  const handleOpenResetPassword = (user: User) => {
    setUserToResetPassword(user);
    setResetForm({ newPassword: '', confirmPassword: '' });
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setForceChangeOnLogin(true);
    setUseAutoGenerate(false);
    setResetSuccess(null);
  };

  const handleCloseResetPassword = () => {
    setUserToResetPassword(null);
    setResetSuccess(null);
    setResetForm({ newPassword: '', confirmPassword: '' });
  };

  const handleSubmitResetPassword = () => {
    if (!userToResetPassword) return;

    if (!useAutoGenerate) {
      if (!resetForm.newPassword) {
        toast({ title: "Validation Error", description: "Please enter a new password.", variant: "destructive" });
        return;
      }
      if (resetForm.newPassword.length < 6) {
        toast({ title: "Validation Error", description: "Password must be at least 6 characters.", variant: "destructive" });
        return;
      }
      if (resetForm.newPassword !== resetForm.confirmPassword) {
        toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" });
        return;
      }
    }

    resetPasswordMutation.mutate({
      userId: userToResetPassword.id,
      newPassword: useAutoGenerate ? undefined : resetForm.newPassword,
      forceChange: forceChangeOnLogin,
    });
  };

  const handleCopyPassword = (password: string) => {
    navigator.clipboard.writeText(password).then(() => {
      toast({ title: "Copied", description: "Password copied to clipboard." });
    });
  };

  const passwordStrength = (pwd: string) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', textColor: 'text-red-600' };
    if (score === 2) return { label: 'Fair', color: 'bg-amber-500', textColor: 'text-amber-600' };
    if (score === 3) return { label: 'Good', color: 'bg-blue-500', textColor: 'text-blue-600' };
    return { label: 'Strong', color: 'bg-green-500', textColor: 'text-green-600' };
  };

  const strength = passwordStrength(resetForm.newPassword);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          User Management
        </h1>
        <p className="text-muted-foreground">
          Manage system users, approve registrations, and control account access.
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
          <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg">
            <TabsTrigger value="all" className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
              All ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="active" className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
              Active ({counts.active})
            </TabsTrigger>
            <TabsTrigger value="pending" className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
              Pending ({counts.pending})
            </TabsTrigger>
            <TabsTrigger value="suspended" className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
              Suspended ({counts.suspended})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            data-testid="input-user-search"
          />
        </div>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="w-[300px] text-xs font-bold uppercase tracking-widest text-slate-500">User Details</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Role</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500">Status</TableHead>
                <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-slate-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <RotateCcw className="h-4 w-4 animate-spin" />
                      <span className="text-sm font-medium">Loading database...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-sm font-medium">
                    No users found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                    data-testid={`row-user-${user.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800">
                          <AvatarImage src={user.profileImageUrl || undefined} />
                          <AvatarFallback className="bg-blue-600 text-white text-xs font-bold uppercase">
                            {user.firstName[0]}{user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {user.firstName} {user.lastName}
                          </span>
                          <span className="text-xs text-slate-500 truncate">{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="h-3 w-3 text-blue-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          {getRoleNameById(user.roleId)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${
                        user.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' :
                        user.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        'bg-red-100 text-red-700 border-red-200'
                      } font-black text-[9px] uppercase tracking-tighter h-5 px-1.5 border`}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
                            disabled={unsuspendMutation.isPending && unsuspendMutation.variables === user.id}
                            data-testid={`button-actions-${user.id}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-1 rounded-xl shadow-xl border-slate-200 dark:border-slate-800">
                          <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Manage Account
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="rounded-lg py-2 text-sm cursor-pointer flex items-center gap-2 font-medium">
                            <Eye className="h-4 w-4 text-blue-500" />
                            View Profile
                          </DropdownMenuItem>
                          {user.status === 'pending' && (
                            <DropdownMenuItem
                              className="rounded-lg py-2 text-sm cursor-pointer flex items-center gap-2 text-green-600 font-bold"
                              onClick={() => approveMutation.mutate(user.id)}
                              data-testid={`button-approve-${user.id}`}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Verify & Activate
                            </DropdownMenuItem>
                          )}
                          {user.status === 'suspended' && (
                            <DropdownMenuItem
                              className="rounded-lg py-2 text-sm cursor-pointer flex items-center gap-2 text-green-600 font-bold"
                              onClick={() => setUserToUnsuspend(user)}
                              data-testid={`button-unsuspend-${user.id}`}
                            >
                              <ShieldOff className="h-4 w-4" />
                              Unsuspend Account
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="rounded-lg py-2 text-sm cursor-pointer flex items-center gap-2 font-medium"
                            onClick={() => handleOpenResetPassword(user)}
                            data-testid={`button-reset-password-${user.id}`}
                          >
                            <KeyRound className="h-4 w-4 text-amber-500" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg py-2 text-sm cursor-pointer flex items-center gap-2 font-medium">
                            <UserCog className="h-4 w-4 text-purple-500" />
                            Modify Role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="rounded-lg py-2 text-sm cursor-pointer flex items-center gap-2 text-red-600 font-bold">
                            <Trash2 className="h-4 w-4" />
                            Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Unsuspend Confirmation Dialog */}
      <AlertDialog open={!!userToUnsuspend} onOpenChange={(open) => { if (!open) setUserToUnsuspend(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsuspend Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unsuspend{' '}
              <strong>{userToUnsuspend?.firstName} {userToUnsuspend?.lastName}</strong>?
              <br /><br />
              Their account will be restored to active status and they will be able to sign in again immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnsuspend}
              className="bg-green-600 hover:bg-green-700"
            >
              Yes, Unsuspend Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Modal */}
      <Dialog open={!!userToResetPassword} onOpenChange={(open) => { if (!open) handleCloseResetPassword(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <KeyRound className="h-4 w-4 text-amber-600" />
              </div>
              Reset Password
            </DialogTitle>
            <DialogDescription>
              {userToResetPassword && (
                <span>
                  Set a new password for{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {userToResetPassword.firstName} {userToResetPassword.lastName}
                  </strong>
                  {' '}({userToResetPassword.username || userToResetPassword.email})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {resetSuccess ? (
            /* Success State */
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-200">Password Reset Successfully</p>
                  <p className="text-xs text-green-700 dark:text-green-300">{resetSuccess.message}</p>
                </div>
              </div>

              {resetSuccess.temporaryPassword && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Temporary Password
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 select-all">
                      {resetSuccess.temporaryPassword}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyPassword(resetSuccess.temporaryPassword!)}
                      className="shrink-0"
                      data-testid="button-copy-temp-password"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Share this password securely with the user. It won't be shown again.
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button onClick={handleCloseResetPassword} className="w-full" data-testid="button-done-reset">
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* Form State */
            <div className="space-y-5 py-2">
              {/* Auto-generate toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-semibold">Auto-generate password</p>
                    <p className="text-xs text-muted-foreground">System creates a secure temporary password</p>
                  </div>
                </div>
                <Switch
                  checked={useAutoGenerate}
                  onCheckedChange={setUseAutoGenerate}
                  data-testid="switch-auto-generate"
                />
              </div>

              {!useAutoGenerate && (
                <div className="space-y-4">
                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-semibold">
                      New Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={resetForm.newPassword}
                        onChange={(e) => setResetForm(f => ({ ...f, newPassword: e.target.value }))}
                        placeholder="Enter new password"
                        className="pr-10"
                        data-testid="input-new-password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Strength indicator */}
                    {resetForm.newPassword && strength && (
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          {['Weak', 'Fair', 'Good', 'Strong'].map((level, i) => (
                            <div
                              key={level}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                ['Weak', 'Fair', 'Good', 'Strong'].indexOf(strength.label) >= i
                                  ? strength.color
                                  : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                        <p className={`text-xs font-medium ${strength.textColor}`}>
                          {strength.label} password
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm font-semibold">
                      Confirm Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={resetForm.confirmPassword}
                        onChange={(e) => setResetForm(f => ({ ...f, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                        className={`pr-10 ${
                          resetForm.confirmPassword && resetForm.newPassword !== resetForm.confirmPassword
                            ? 'border-red-400 focus-visible:ring-red-400'
                            : resetForm.confirmPassword && resetForm.newPassword === resetForm.confirmPassword
                            ? 'border-green-400 focus-visible:ring-green-400'
                            : ''
                        }`}
                        data-testid="input-confirm-password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {resetForm.confirmPassword && resetForm.newPassword !== resetForm.confirmPassword && (
                      <p className="text-xs text-red-500">Passwords do not match</p>
                    )}
                    {resetForm.confirmPassword && resetForm.newPassword === resetForm.confirmPassword && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Passwords match
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Force change on login */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-sm font-semibold">Require password change</p>
                  <p className="text-xs text-muted-foreground">User must set a new password at next login</p>
                </div>
                <Switch
                  checked={forceChangeOnLogin}
                  onCheckedChange={setForceChangeOnLogin}
                  data-testid="switch-force-change"
                />
              </div>

              <DialogFooter className="gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={handleCloseResetPassword}
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-cancel-reset"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitResetPassword}
                  disabled={resetPasswordMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  data-testid="button-confirm-reset"
                >
                  {resetPasswordMutation.isPending ? (
                    <><RotateCcw className="h-4 w-4 mr-2 animate-spin" /> Resetting...</>
                  ) : (
                    <><KeyRound className="h-4 w-4 mr-2" /> Reset Password</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
