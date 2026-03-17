import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';
import { useEffect, useTransition, useState } from 'react';
import { getPortalByRoleId } from '@/lib/roles';
import { PortalLayoutSkeleton, SuperAdminLayoutSkeleton } from '@/components/ui/skeletons';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoleIds: number[];
  fallbackPath?: string;
}

export default function ProtectedRoute({ 
  children, 
  allowedRoleIds, 
  fallbackPath = '/login' 
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isRoleAllowed = (userRoleId: number, allowed: number[]): boolean => {
    return allowed.includes(userRoleId);
  };

  const isSuperAdminRoute = location.startsWith('/portal/superadmin');
  const LoadingSkeleton = isSuperAdminRoute ? SuperAdminLayoutSkeleton : PortalLayoutSkeleton;

  useEffect(() => {
    if (isLoading) return;
    
    if (!isAuthenticated) {
      setIsRedirecting(true);
      startTransition(() => navigate(fallbackPath));
      return;
    }
    if (user && !isRoleAllowed(user.roleId, allowedRoleIds)) {
      const correctPortal = getPortalByRoleId(user.roleId);
      setIsRedirecting(true);
      startTransition(() => navigate(correctPortal));
      return;
    }
    setIsRedirecting(false);
  }, [isAuthenticated, isLoading, user, allowedRoleIds, navigate, fallbackPath]);

  if (isLoading || isPending || isRedirecting) {
    return <LoadingSkeleton />;
  }

  if (!isAuthenticated || !user) {
    return <LoadingSkeleton />;
  }

  if (!isRoleAllowed(user.roleId, allowedRoleIds)) {
    return <LoadingSkeleton />;
  }
  
  return <>{children}</>;
}
