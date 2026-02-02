
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Search, UserPlus, MoreVertical, ShieldCheck, Ban, RefreshCw, Key, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { User as UserType } from "@shared/schema";
import { formatDistance } from "date-fns";
import { ROLE_IDS } from "@/lib/roles";

const adminSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
});

type AdminFormData = z.infer<typeof adminSchema>;

export default function SuperAdminManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: admins, isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/superadmin/admins"],
  });

  const form = useForm<AdminFormData>({
    resolver: zodResolver(adminSchema),
    defaultValues: { firstName: "", lastName: "", email: "" },
  });

  const createAdminMutation = useMutation({
    mutationFn: async (data: AdminFormData) => {
      const response = await apiRequest("POST", "/api/superadmin/admins", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Admin Created", description: "Privileged account established successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/admins"] });
      setIsAddDialogOpen(false);
      form.reset();
    },
  });

  const filteredAdmins = (admins || []).filter((admin) =>
    `${admin.firstName} ${admin.lastName} ${admin.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admins</h1>
            <p className="text-muted-foreground mt-1">Manage privileged users and system administrators.</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="w-full md:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Add New Admin
          </Button>
        </div>

        <Card className="shadow-sm border-indigo-100 dark:border-indigo-900/20">
          <CardHeader className="pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search administrators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="font-semibold">Administrator</TableHead>
                    <TableHead className="font-semibold">Identity</TableHead>
                    <TableHead className="font-semibold">Admin Role</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">Last Active</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(3).fill(0).map((_, i) => (
                      <TableRow key={i} className="animate-pulse">
                        <TableCell colSpan={6} className="h-16 bg-slate-100/50 dark:bg-slate-800/50" />
                      </TableRow>
                    ))
                  ) : filteredAdmins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                        No administrators found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAdmins.map((admin) => (
                      <TableRow key={admin.id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors">
                        <TableCell className="font-medium">
                          {admin.firstName} {admin.lastName}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span className="font-mono text-xs">{admin.username}</span>
                            <span className="text-muted-foreground truncate max-w-[150px]">{admin.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200">
                            {admin.roleId === ROLE_IDS.SUPER_ADMIN ? "Super Admin" : "System Admin"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              admin.status === "active" 
                                ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200" 
                                : "bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                            }
                          >
                            {admin.status === "active" ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                          {admin.lastLoginAt ? formatDistance(new Date(admin.lastLoginAt), new Date(), { addSuffix: true }) : "Never"}
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
                                <Edit className="mr-2 h-4 w-4" /> Edit Admin
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:text-red-700 cursor-pointer">
                                <Ban className="mr-2 h-4 w-4" /> Disable Access
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer">
                                <Key className="mr-2 h-4 w-4" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:text-red-700 cursor-pointer font-medium">
                                <Trash2 className="mr-2 h-4 w-4" /> Revoke Admin
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

        {/* Create Admin Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Administrator</DialogTitle>
              <DialogDescription>
                Establish a new privileged account. System-generated credentials will be provided upon creation.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createAdminMutation.mutate(v))} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="admin@treasurehome.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <Button variant="outline" type="button" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createAdminMutation.isPending}>
                    {createAdminMutation.isPending ? "Creating..." : "Establish Account"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
}
