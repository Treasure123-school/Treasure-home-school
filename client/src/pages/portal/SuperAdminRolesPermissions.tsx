
import { useState } from "react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  Trash2, 
  Edit, 
  ShieldCheck, 
  Users as UsersIcon, 
  GraduationCap, 
  FileText, 
  Settings as SettingsIcon,
  Search
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SuperAdminRolesPermissions() {
  const [searchQuery, setSearchQuery] = useState("");

  const roles = [
    { id: 1, name: "Super Admin", description: "Full system access, including security and settings.", users: 2 },
    { id: 2, name: "Admin", description: "Broad academic and administrative management.", users: 5 },
    { id: 3, name: "Teacher", description: "Manage classes, subjects, results, and student attendance.", users: 45 },
    { id: 4, name: "Student", description: "Access to learning materials, results, and profile.", users: 850 },
    { id: 5, name: "Parent", description: "Monitor child academic progress and pay fees.", users: 1200 },
  ];

  const permissionGroups = [
    {
      title: "Users & Security",
      icon: UsersIcon,
      permissions: ["View Users", "Create Users", "Edit Users", "Delete Users", "Manage Security Policies"]
    },
    {
      title: "Academic Management",
      icon: GraduationCap,
      permissions: ["Manage Classes", "Assign Subjects", "Track Attendance", "Process Results"]
    },
    {
      title: "Reporting",
      icon: FileText,
      permissions: ["Generate Report Cards", "View Analytics", "Export Academic Data"]
    },
    {
      title: "System Settings",
      icon: SettingsIcon,
      permissions: ["Configure Branding", "Manage Integrations", "Run Backups", "API Access"]
    }
  ];

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
            <p className="text-muted-foreground mt-1">Define authorization levels and control system access.</p>
          </div>
          <Button className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Create Custom Role
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Roles List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search roles..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="space-y-3">
              {roles.map((role) => (
                <Card 
                  key={role.id} 
                  className={`cursor-pointer transition-all hover:border-blue-300 dark:hover:border-blue-900 shadow-sm ${role.id === 1 ? 'border-blue-500 ring-1 ring-blue-500/20' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{role.name}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">{role.description}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {role.users} Users
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Permissions Editor */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">Super Admin Permissions</CardTitle>
                    <CardDescription>Full system control and configuration capability.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Role
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                {permissionGroups.map((group) => (
                  <div key={group.title} className="space-y-4">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <group.icon className="h-5 w-5 text-blue-600" />
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">{group.title}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.permissions.map((perm) => (
                        <div key={perm} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                          <Checkbox id={perm} checked disabled className="data-[state=checked]:bg-blue-600" />
                          <Label htmlFor={perm} className="text-sm font-medium cursor-pointer flex-1">
                            {perm}
                          </Label>
                          <ShieldCheck className="h-4 w-4 text-green-600 opacity-50" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                <div className="pt-4 border-t flex justify-end">
                  <Button disabled>Save Permission Changes</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
