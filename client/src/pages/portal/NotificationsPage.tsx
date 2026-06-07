import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
import {
  Bell, UserPlus, AlertCircle, BookOpen, Calendar, MessageSquare,
  GraduationCap, CheckCheck, Check, Inbox, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Types ────────────────────────────────────────────────────────────────
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

type FilterTab = "all" | "unread" | "read";

// ── Helpers ──────────────────────────────────────────────────────────────
function getNotificationIcon(type: string) {
  switch (type) {
    case "pending_user":  return <UserPlus     className="h-5 w-5 text-orange-500" />;
    case "exam":          return <BookOpen     className="h-5 w-5 text-purple-500" />;
    case "grade":         return <GraduationCap className="h-5 w-5 text-green-500" />;
    case "schedule":      return <Calendar     className="h-5 w-5 text-primary"   />;
    case "message":       return <MessageSquare className="h-5 w-5 text-cyan-500"  />;
    case "announcement":  return <Bell         className="h-5 w-5 text-pink-500"   />;
    default:              return <AlertCircle  className="h-5 w-5 text-primary"   />;
  }
}

function getIconBg(type: string) {
  switch (type) {
    case "pending_user":  return "bg-orange-100 dark:bg-orange-900/30";
    case "exam":          return "bg-purple-100 dark:bg-purple-900/30";
    case "grade":         return "bg-green-100  dark:bg-green-900/30";
    case "schedule":      return "bg-primary/10   dark:bg-primary/5";
    case "message":       return "bg-cyan-100   dark:bg-cyan-900/30";
    case "announcement":  return "bg-pink-100   dark:bg-pink-900/30";
    default:              return "bg-primary/10   dark:bg-primary/5";
  }
}

// ── Skeleton ─────────────────────────────────────────────────────────────
function NotificationSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Notification Card ─────────────────────────────────────────────────────
function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: number) => void;
}) {
  return (
    <Card
      className={`transition-colors hover:shadow-sm ${
        !notification.isRead
          ? "border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/5"
          : ""
      }`}
      data-testid={`notification-card-${notification.id}`}
    >
      <CardContent className="p-4 flex items-start gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${getIconBg(notification.type)}`}>
          {getNotificationIcon(notification.type)}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold leading-snug ${
              !notification.isRead ? "text-foreground" : "text-muted-foreground"
            }`}>
              {notification.title}
              {!notification.isRead && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary/85 align-middle" />
              )}
            </p>
            {!notification.isRead && (
              <button
                onClick={() => onMarkRead(notification.id)}
                title="Mark as read"
                className="flex-shrink-0 mt-0.5 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                data-testid={`mark-read-${notification.id}`}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
            {notification.message}
          </p>

          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{format(new Date(notification.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────
function EmptyState({ tab }: { tab: FilterTab }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="text-no-notifications">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
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
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

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
  const readList    = notifications.filter((n) =>  n.isRead);
  const unreadList  = notifications.filter((n) => !n.isRead);

  const filtered = notifications.filter((n) => {
    if (activeTab === "unread") return !n.isRead;
    if (activeTab === "read")   return  n.isRead;
    return true;
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PUT", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/notifications/mark-all-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all",    label: "All",    count: notifications.length },
    { key: "unread", label: "Unread", count: unreadList.length    },
    { key: "read",   label: "Read",   count: readList.length      },
  ];

  return (
    <div className="space-y-6 pb-8" data-testid="notifications-page">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
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

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="stat-total">{notifications.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary dark:text-primary/70" data-testid="stat-unread">{unreadCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Unread</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground" data-testid="stat-read">{readList.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Read</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Tabs ── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList>
          {tabs.map(({ key, label, count }) => (
            <TabsTrigger key={key} value={key} data-testid={`button-filter-${key}`}>
              {label} ({count})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ── List ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <NotificationSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className="space-y-3">
          {filtered.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={(id) => markAsReadMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
