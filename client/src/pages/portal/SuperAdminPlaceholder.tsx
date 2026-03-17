import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface SuperAdminPlaceholderProps {
  title: string;
  description?: string;
  category?: string;
}

export default function SuperAdminPlaceholder({ 
  title, 
  description = "This feature is currently under development.",
  category = "System"
}: SuperAdminPlaceholderProps) {
  const [, navigate] = useLocation();

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/portal/superadmin")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
                {title}
              </h1>
              <Badge variant="secondary" className="text-xs">
                {category}
              </Badge>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {description}
            </p>
          </div>
        </div>

        <Card className="border-dashed">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full w-fit mb-4">
              <Construction className="h-12 w-12 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-xl">Coming Soon</CardTitle>
            <CardDescription>
              This module is being developed and will be available in a future update.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 max-w-md mx-auto">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                What to expect:
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 text-left list-disc list-inside">
                <li>Full enterprise-grade functionality</li>
                <li>Seamless integration with existing modules</li>
                <li>Role-based access controls</li>
                <li>Comprehensive audit logging</li>
              </ul>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate("/portal/superadmin")}
              data-testid="button-return-dashboard"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
