import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  History,
  Shield,
  UserCheck,
  UserX,
  Trash2,
  KeyRound,
  UserCog,
  AlertCircle,
  Clock,
  User
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface AuditLog {
  id: number;
  userId: string;
  action: string;
  entityType: string;
  entityId: bigint;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  userEmail?: string;
  userName?: string;
}
export default function AuditLogs() {
  const { user } = useAuth();
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [limit, setLimit] = useState<number>(50);

  // Fetch audit logs
  const { data: allLogs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['/api/audit-logs', { limit, action: actionFilter === 'all' ? undefined : actionFilter }],
  });

  if (!user) {
    return <div>Please log in to access the admin portal.</div>;
  }
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (action: string) => {
    const iconMap: Record<string, any> = {
      'user_approved': <UserCheck className="h-4 w-4" />,
      'user_status_changed': <AlertCircle className="h-4 w-4" />,
      'user_deleted': <Trash2 className="h-4 w-4" />,
      'password_reset': <KeyRound className="h-4 w-4" />,
      'role_changed': <UserCog className="h-4 w-4" />,
    };
    return iconMap[action] || <Shield className="h-4 w-4" />;
  };

  const getActionBadge = (action: string) => {
    const badgeMap: Record<string, { variant: any; label: string }> = {
      'user_approved': { variant: 'default', label: 'Approved' },
      'user_status_changed': { variant: 'secondary', label: 'Status Changed' },
      'user_deleted': { variant: 'destructive', label: 'Deleted' },
      'password_reset': { variant: 'outline', label: 'Password Reset' },
      'role_changed': { variant: 'outline', label: 'Role Changed' },
    };
    
    const config = badgeMap[action] || { variant: 'outline', label: action };
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const parseValue = (value: string | null) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const getChangeDescription = (log: AuditLog) => {
    const oldVal = parseValue(log.oldValue);
    const newVal = parseValue(log.newValue);

    if (log.action === 'user_approved') {
      return `Approved user account`;
    }
    if (log.action === 'user_status_changed') {
      return `Changed status from ${oldVal?.status || 'unknown'} to ${newVal?.status || 'unknown'}`;
    }
    if (log.action === 'user_deleted') {
      return `Permanently deleted user account (${oldVal?.email || 'unknown'})`;
    }
    if (log.action === 'password_reset') {
      return newVal?.mustChangePassword 
        ? 'Reset password (force change on next login)' 
        : 'Reset password';
    }
    if (log.action === 'role_changed') {
      return `Changed role from ${oldVal?.roleName || 'unknown'} to ${newVal?.roleName || 'unknown'}`;
    }
    return log.action;
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
              <History className="h-6 w-6 sm:h-8 sm:w-8" />
              Audit Logs
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1" data-testid="text-page-description">
              Track all admin actions and system changes for accountability
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-action-filter">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="user_approved">Approved</SelectItem>
                <SelectItem value="user_status_changed">Status Changed</SelectItem>
                <SelectItem value="user_deleted">Deleted</SelectItem>
                <SelectItem value="password_reset">Password Reset</SelectItem>
                <SelectItem value="role_changed">Role Changed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={limit.toString()} onValueChange={(val) => setLimit(parseInt(val))}>
              <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-limit">
                <SelectValue placeholder="Show..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">Show 25</SelectItem>
                <SelectItem value="50">Show 50</SelectItem>
                <SelectItem value="100">Show 100</SelectItem>
                <SelectItem value="250">Show 250</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Audit Logs List */}
        <Card data-testid="card-audit-logs">
          <CardHeader>
            <CardTitle>Admin Activity Log</CardTitle>
            <CardDescription>
              Showing {allLogs.length} most recent {actionFilter !== 'all' ? `'${actionFilter}'` : ''} actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">
                Loading audit logs...
              </div>
            ) : allLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-logs">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">No audit logs found</p>
                <p className="text-sm">Admin actions will appear here once they occur</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    data-testid={`log-entry-${log.id}`}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1 p-2 rounded-lg bg-primary/10 text-primary">
                        {getActionIcon(log.action)}
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {getActionBadge(log.action)}
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                        
                        <p className="font-medium" data-testid={`text-description-${log.id}`}>
                          {getChangeDescription(log)}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1" data-testid={`text-admin-${log.id}`}>
                            <User className="h-3 w-3" />
                            Admin: {log.userName || log.userEmail || 'Unknown'}
                          </span>
                          {log.ipAddress && (
                            <span data-testid={`text-ip-${log.id}`}>
                              IP: {log.ipAddress}
                            </span>
                          )}
                        </div>
                        
                        {log.reason && (
                          <p className="text-sm text-muted-foreground italic" data-testid={`text-reason-${log.id}`}>
                            Reason: {log.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
