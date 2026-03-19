import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Construction, ArrowLeft, Sparkles, Rocket, Shield, Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { getPortalByRoleId, getRoleNameById } from "@/lib/roles";

export default function PortalComingSoon() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  const dashboardPath = user ? getPortalByRoleId(user.roleId) : "/login";
  const roleName = user ? getRoleNameById(user.roleId) : "User";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4" data-testid="page-portal-coming-soon">
      <Card className="w-full max-w-lg border-dashed">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto bg-amber-100 dark:bg-amber-900/30 p-5 rounded-full w-fit mb-4">
            <Construction className="h-12 w-12 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="text-coming-soon-title">
            Feature Coming Soon
          </CardTitle>
          <CardDescription className="text-base mt-2" data-testid="text-coming-soon-description">
            We're working hard to bring you this feature. It will be available in an upcoming update.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-5">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              What you can look forward to:
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-muted-foreground">
                <Rocket className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                <span>A fully functional module designed with your needs in mind</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                <span>Secure access with role-based permissions and data protection</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-muted-foreground">
                <Bell className="h-4 w-4 mt-0.5 text-purple-500 flex-shrink-0" />
                <span>You'll be notified when this feature becomes available</span>
              </li>
            </ul>
          </div>

          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              In the meantime, explore other features in your {roleName} portal.
            </p>
            <Button 
              onClick={() => navigate(dashboardPath)}
              className="gap-2"
              data-testid="button-return-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
