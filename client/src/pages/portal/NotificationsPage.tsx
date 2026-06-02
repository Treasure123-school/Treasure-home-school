import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
import { useAuth } from "@/lib/auth";
import {
  Bell, UserPlus, AlertCircle, BookOpen, Calendar, MessageSquare,
  GraduationCap, CheckCheck, Check, Filter, Inbox, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

function getNotificationIcon(type: string, size = "h-5 w-5") {
  switch (type) {
    case "pending_user":
      return <UserPlus className={`${size} text-orange-500`} />;
    case "exam":
      return <BookOpen className={`${size} text-purple-500`} />;
    case "grade":
      return <GraduationCap className={`${size} text-green-500`} />;
    case "schedule":
      return <Calendar className={`${size} text-blue-500`} />;
    case "message":
      return <MessageSquare className={`${size} text-cyan-500`} />;
    case "announcement":
      return <Bell className={`${size} text-pink-500`} />;
    default:
      return <AlertCircle className={`${size} text-blue-500`} />;
  }
}

function getIconBg(type: string) {
  switch (type) {
    case "pending_user": return "bg-orange-100 dark:bg-orange-900/30";
    case "exam": return "bg-purple-100 dark:bg-purple-900/30";
    case "grade": return "bg-green-100 dark:bg-green-900/30";
    case "schedule": return "bg-blue-100 dark:bg-blue-900/30";
    case "message": return "bg-cyan-100 dark:bg-cyan-900/30";
    case "announcement": return "bg-pink-100 dark:bg-pink-900/30";
    default: return "bg-blue-100 dark:bg-blue-900/30";
  }
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 border-b last:border-b-0">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: number) => void;
}) {
  return (
    <div
      className={`flex items-start gap-4 p-4 border-b last:border-b-0 transition-colors hover:bg-muted/40 ${
        !notification.isRead ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
      }`}
      data-testid={`notification-card-${notification.id}`}
    >
      <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${getIconBg(notification.type)}`}>
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-snug ${!notification.isRead ? "text-foreground" : "text-muted-foreground"}`}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <button
              onClick={() => onMarkRead(notification.id)}
              title="Mark as read"
              className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors"
              data-testid={`mark-read-${notification.id}`}
            >
              <Check className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{notification.message}</p>
        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{format(new Date(notification.createdAt), "MMM d, yyyy")}</span>
          {!notification.isRead && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-1 text-blue-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                Unread
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "read">("all");

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const unreadCount = unreadData?.count ?? 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("PUT", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const filtered = notifications.filter((n) => {
    if (activeTab === "unread") return !n.isRead;
    if (activeTab === "read") return n.isRead;
    return true;
  });

  const unreadList = notifications.filter((n) => !n.isRead);
  const readList = notifications.filter((n) => n.isRead);

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-7 w-7 text-orange-500" />
            Notifications
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Stay up to date with everything happening in your portal.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            className="flex items-center gap-2 shrink-0"
            data-testid="button-mark-all-read"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-2xl font-bold">{notifications.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total</p>
        </div>
        <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-3 text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{unreadCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Unread</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{readList.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Read</p>
        </div>
      </div>

      {/* Tabs + list */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center justify-between px-4 pt-3 border-b">
            <TabsList className="bg-transparent gap-1 h-auto p-0">
              <TabsTrigger
                value="all"
                className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                All
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {notifications.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="unread"
                className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Unread
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="read"
                className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Read
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {readList.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </div>

          {["all", "unread", "read"].map((tab) => (
            <TabsContent key={tab} value={tab} className="m-0">
              {isLoading ? (
                <div>
                  {[1, 2, 3].map((i) => <NotificationSkeleton key={i} />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center" data-testid="text-no-notifications">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Inbox className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="font-semibold text-foreground">
                    {tab === "unread" ? "All caught up!" : "No notifications"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tab === "unread"
                      ? "You have no unread notifications."
                      : tab === "read"
                      ? "No read notifications yet."
                      : "You'll be notified of important updates here."}
                  </p>
                </div>
              ) : (
                <div>
                  {filtered.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onMarkRead={(id) => markAsReadMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
