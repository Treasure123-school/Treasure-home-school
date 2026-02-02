import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
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
  Search
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

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
                  <TableRow key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-1 rounded-xl shadow-xl border-slate-200 dark:border-slate-800">
                          <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Manage Account</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="rounded-lg py-2 text-sm cursor-pointer flex items-center gap-2 font-medium">
                            <Eye className="h-4 w-4 text-blue-500" />
                            View Profile
                          </DropdownMenuItem>
                          {user.status === 'pending' && (
                            <DropdownMenuItem 
                              className="rounded-lg py-2 text-sm cursor-pointer flex items-center gap-2 text-green-600 font-bold"
                              onClick={() => approveMutation.mutate(user.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Verify & Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="rounded-lg py-2 text-sm cursor-pointer flex items-center gap-2 font-medium">
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
    </div>
  );
}
