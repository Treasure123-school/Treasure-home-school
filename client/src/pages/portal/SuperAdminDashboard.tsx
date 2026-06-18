import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SuperAdminDashboardSkeleton } from "@/components/ui/page-skeletons";
import { Users, Shield, Activity, Database, TrendingUp, UserPlus, Settings, Award, ChevronRight } from "lucide-react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { WelcomeCard, StatCardShell, StatCardIcon } from "@/components/shared";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useSocketIORealtime } from "@/hooks/useSocketIORealtime";
import { useLoginSuccess } from "@/hooks/use-login-success";

interface DashboardStats {
  totalAdmins?: number;
  totalUsers?: number;
  activeSessions?: number;
  totalExams?: number;
}
export default function SuperAdminDashboard() {
  const { user } = useAuth();
  
  useLoginSuccess();
  
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/public/settings"],
    refetchInterval: 5000,
  });

  const schoolName = settings?.schoolName || "";

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/superadmin/stats"],
  });

  // Enable real-time updates for dashboard stats when users or exams change
  useSocketIORealtime({ 
    table: 'users', 
    queryKey: ["/api/superadmin/stats"]
  });
  
  useSocketIORealtime({ 
    table: 'exams', 
    queryKey: ["/api/superadmin/stats"]
  });

  const statCards = [
    {
      title: "Total Admins",
      value: stats?.totalAdmins || 0,
      icon: Shield,
      description: "System administrators",
      gradient: "from-primary/85 to-primary",
      bgGradient: "from-primary/85/10",
    },
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      icon: Users,
      description: "All platform users",
      gradient: "from-green-500 to-emerald-600",
      bgGradient: "from-green-500/10",
    },
    {
      title: "Active Sessions",
      value: stats?.activeSessions || 0,
      icon: Activity,
      description: "Currently online",
      gradient: "from-purple-500 to-purple-600",
      bgGradient: "from-purple-500/10",
    },
    {
      title: "Total Exams",
      value: stats?.totalExams || 0,
      icon: Database,
      description: "Exams in system",
      gradient: "from-orange-500 to-orange-600",
      bgGradient: "from-orange-500/10",
    },
  ];

  // Show contextual skeleton during initial data loading
  if (isLoading) {
    return (
      <SuperAdminLayout>
        <SuperAdminDashboardSkeleton />
      </SuperAdminLayout>
    );
  }

  const quickActions = [
    {
      title: "Admin Management",
      icon: Shield,
      color: "from-primary/85 to-primary",
      href: "/portal/superadmin/admins",
      description: "Manage system admins"
    },
    {
      title: "System Logs",
      icon: Activity,
      color: "from-purple-500 to-purple-600",
      href: "/portal/superadmin/logs",
      description: "View activity logs"
    },
    {
      title: "Settings",
      icon: Settings,
      color: "from-green-500 to-green-600",
      href: "/portal/superadmin/settings",
      description: "Configure system"
    },
    {
      title: "Profile",
      icon: UserPlus,
      color: "from-orange-500 to-orange-600",
      href: "/portal/superadmin/profile",
      description: "Manage profile"
    },
  ];

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Welcome Header Card */}
        <WelcomeCard
          icon={Shield}
          name={user?.lastName || 'Admin'}
          subtitle={`Super Admin · ${schoolName}`}
          showDate
          className="mb-6"
          data-testid="superadmin-dashboard-header"
        />

        {/* Modern Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {statCards.map((stat, index) => (
            <StatCardShell
              key={stat.title}
              glowColor={`${stat.bgGradient} to-transparent`}
              animationDuration={500 + index * 200}
              data-testid={`card-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex items-start justify-between mb-2 sm:mb-4">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">{stat.title}</p>
                  <div className="flex items-baseline gap-1.5 sm:gap-2">
                    {isLoading ? (
                      <Skeleton className="h-8 sm:h-10 w-16 sm:w-20" />
                    ) : (
                      <AnimatedCounter
                        value={stat.value}
                        className={`text-2xl sm:text-4xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}
                      />
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">
                    {stat.description}
                  </p>
                </div>
                <StatCardIcon icon={stat.icon} gradient={stat.gradient} />
              </div>
            </StatCardShell>
          ))}
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href}>
                <Card 
                  className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDuration: `${700 + index * 200}ms` }}
                  data-testid={`action-${action.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${action.color} text-white shadow-lg`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg mb-1">{action.title}</h3>
                          <p className="text-sm text-muted-foreground">{action.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* System Monitoring & Security Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-lg border-none animate-in fade-in slide-in-from-bottom-4 duration-1000 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">System Health</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Server Status</span>
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    Operational
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Database Sync</span>
                  <span className="text-primary font-medium">Real-time</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active WebSockets</span>
                  <span className="text-purple-600 font-medium">Connected</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none animate-in fade-in slide-in-from-bottom-4 duration-1000 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Shield className="h-5 w-5 text-orange-600" />
                </div>
                <CardTitle className="text-lg">Security Overview</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Auth System</span>
                  <span className="text-emerald-600 font-medium">Secure</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Latest Login</span>
                  <span className="text-muted-foreground italic">Just now</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Admin Access</span>
                  <span className="text-orange-600 font-medium font-mono text-xs uppercase px-1.5 py-0.5 rounded bg-orange-100">Super Admin</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
