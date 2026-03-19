
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Search, ShieldCheck, Ban, RefreshCw, History, Save, AlertTriangle, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

export default function SuperAdminUserAccessControl() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [accessReason, setAccessReason] = useState("");

  const { data: users, isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string, status: string }) => {
      const endpoint = status === 'active' ? 'unsuspend' : 'suspend';
      return apiRequest("POST", `/api/users/${userId}/${endpoint}`, { reason: accessReason });
    },
    onSuccess: () => {
      toast({ title: "Access Updated", description: "Individual user access status has been modified." });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAccessReason("");
    },
  });

  const filteredUsers = (users || []).filter((u) => 
    `${u.firstName} ${u.lastName} ${u.email} ${u.username}`.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5); // Just show top 5 for the selector UI

  return (
    <SuperAdminLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Access Control</h1>
          <p className="text-muted-foreground mt-1">Manage individual account status and access restrictions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* User Selector */}
          <div className="md:col-span-5 space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Find User</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name or identity..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <p className="text-sm text-center py-4 italic text-muted-foreground">Searching users...</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-sm text-center py-4 italic text-muted-foreground">No users found.</p>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${selectedUser?.id === user.id ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/20' : 'hover:bg-slate-50'}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase">{user.username}</p>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Access Status Editor */}
          <div className="md:col-span-7 space-y-6">
            {selectedUser ? (
              <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                    Access Status: {selectedUser.firstName} {selectedUser.lastName}
                  </CardTitle>
                  <CardDescription>Individual login permission and account state.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">Account Access</Label>
                      <p className="text-sm text-muted-foreground">Enable or disable login capability for this user</p>
                    </div>
                    <Switch 
                      checked={selectedUser.status === 'active'}
                      onCheckedChange={(val) => updateStatusMutation.mutate({ userId: selectedUser.id, status: val ? 'active' : 'suspended' })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold">Reason for Modification (Optional)</Label>
                    <Textarea 
                      placeholder="e.g., Temporary suspension due to administrative review..." 
                      value={accessReason}
                      onChange={(e) => setAccessReason(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <p className="text-[10px] text-muted-foreground italic flex items-center gap-1 mt-1">
                      <History className="h-3 w-3" /> This reason will be logged in the system audit trail.
                    </p>
                  </div>

                  <div className="pt-4 border-t flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setSelectedUser(null)}>Deselect</Button>
                    <Button onClick={() => updateStatusMutation.mutate({ userId: selectedUser.id, status: selectedUser.status === 'active' ? 'suspended' : 'active' })}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Access Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed rounded-xl bg-slate-50/30">
                <User className="h-16 w-16 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-500">No User Selected</h3>
                <p className="text-sm text-slate-400 max-w-xs mt-2 italic">
                  Select a user from the left panel to manage their specific access status and restrictions.
                </p>
              </div>
            )}

            <Card className="bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Important</p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                      This page manages individual user access only. To modify portal-wide authentication rules or password requirements, please visit **System Settings → Authentication**.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
