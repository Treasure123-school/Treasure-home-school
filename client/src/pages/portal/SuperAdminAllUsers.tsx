
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Search, Download, Ban, RefreshCw, User, MoreVertical, Key, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";
import { formatDistance, format } from "date-fns";
import { ROLE_IDS, getRoleNameById } from "@/lib/roles";

export default function SuperAdminAllUsers() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: users, isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const suspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/users/${userId}/suspend`, { reason: "Suspended by Super Admin" });
    },
    onSuccess: () => {
      toast({ title: "Account Disabled", description: "The user account has been deactivated." });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/users/${userId}/unsuspend`, {});
    },
    onSuccess: () => {
      toast({ title: "Account Activated", description: "The user account has been reactivated." });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/users/${userId}/reset-password`, {});
    },
    onSuccess: () => {
      toast({ title: "Password Reset", description: "A temporary password has been generated." });
    },
  });

  const filteredUsers = (users || []).filter((user) => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.roleId.toString() === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Users</h1>
            <p className="text-muted-foreground mt-1">Manage and monitor all system accounts from a central location.</p>
          </div>
          <Button variant="outline" className="w-full md:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Export Users
          </Button>
        </div>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {Object.entries(ROLE_IDS).map(([name, id]) => (
                      <SelectItem key={id} value={id.toString()}>{name.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Disabled</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="font-semibold">Full Name</TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">Identity</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">Last Login</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i} className="animate-pulse">
                        <TableCell colSpan={6} className="h-16 bg-slate-100/50 dark:bg-slate-800/50" />
                      </TableRow>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                        No users found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{user.firstName} {user.lastName}</span>
                            <span className="text-xs text-muted-foreground sm:hidden">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col text-sm">
                            <span className="font-mono text-xs">{user.username}</span>
                            <span className="text-muted-foreground truncate max-w-[150px]">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {getRoleNameById(user.roleId)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              user.status === "active" 
                                ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200" 
                                : "bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                            }
                          >
                            {user.status === "active" ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                          {user.lastLoginAt ? formatDistance(new Date(user.lastLoginAt), new Date(), { addSuffix: true }) : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.status === "active" ? (
                                <DropdownMenuItem 
                                  className="text-red-600 focus:text-red-700 cursor-pointer"
                                  onClick={() => suspendMutation.mutate(user.id)}
                                >
                                  <Ban className="mr-2 h-4 w-4" /> Disable Account
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  className="text-green-600 focus:text-green-700 cursor-pointer"
                                  onClick={() => unsuspendMutation.mutate(user.id)}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" /> Activate Account
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                className="cursor-pointer"
                                onClick={() => resetPasswordMutation.mutate(user.id)}
                              >
                                <Key className="mr-2 h-4 w-4" /> Reset Password
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
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Active</p>
                  <p className="text-3xl font-bold mt-1">{users?.filter(u => u.status === 'active').length || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">Disabled</p>
                  <p className="text-3xl font-bold mt-1">{users?.filter(u => u.status === 'suspended').length || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Ban className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Registered</p>
                  <p className="text-3xl font-bold mt-1">{users?.length || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
