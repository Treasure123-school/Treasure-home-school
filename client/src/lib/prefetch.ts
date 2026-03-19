import { queryClient } from "./queryClient";

const prefetchedRoutes = new Set<string>();
const prefetchedQueries = new Set<string>();

export function prefetchRoute(componentLoader: () => Promise<any>, routeKey: string) {
  if (prefetchedRoutes.has(routeKey)) return;
  
  prefetchedRoutes.add(routeKey);
  componentLoader().catch(() => {
    prefetchedRoutes.delete(routeKey);
  });
}

export function prefetchQuery(queryKey: string[], queryFn?: () => Promise<any>) {
  const key = queryKey.join('/');
  if (prefetchedQueries.has(key)) return;
  
  prefetchedQueries.add(key);
  
  const options: { queryKey: string[]; staleTime: number; queryFn?: () => Promise<any> } = {
    queryKey,
    staleTime: 30000,
  };
  
  if (queryFn) {
    options.queryFn = queryFn;
  }
  
  queryClient.prefetchQuery(options).catch(() => {
    prefetchedQueries.delete(key);
  });
}

export function prefetchDashboardData(roleId: number) {
  prefetchQuery(['/api/announcements']);
  
  switch (roleId) {
    case 1:
      prefetchQuery(['/api/superadmin/stats']);
      prefetchQuery(['/api/superadmin/admins']);
      break;
    case 2:
      prefetchQuery(['/api/admin/stats']);
      prefetchQuery(['/api/students']);
      prefetchQuery(['/api/teachers']);
      break;
    case 3:
      prefetchQuery(['/api/teacher/dashboard-stats']);
      prefetchQuery(['/api/teacher/classes']);
      break;
    case 4:
      prefetchQuery(['/api/student/grades']);
      prefetchQuery(['/api/student/attendance']);
      break;
    case 5:
      prefetchQuery(['/api/parent/children']);
      break;
  }
}

export function createHoverPrefetch(
  componentLoader: () => Promise<any>,
  routeKey: string,
  queryKeys?: string[][]
) {
  let prefetchTimeout: NodeJS.Timeout | null = null;
  
  return {
    onMouseEnter: () => {
      prefetchTimeout = setTimeout(() => {
        prefetchRoute(componentLoader, routeKey);
        queryKeys?.forEach(key => prefetchQuery(key));
      }, 100);
    },
    onMouseLeave: () => {
      if (prefetchTimeout) {
        clearTimeout(prefetchTimeout);
        prefetchTimeout = null;
      }
    },
    onFocus: () => {
      prefetchRoute(componentLoader, routeKey);
      queryKeys?.forEach(key => prefetchQuery(key));
    }
  };
}

export function usePrefetchOnVisible(
  componentLoader: () => Promise<any>,
  routeKey: string,
  queryKeys?: string[][]
) {
  return {
    ref: (element: HTMLElement | null) => {
      if (!element) return;
      
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              prefetchRoute(componentLoader, routeKey);
              queryKeys?.forEach(key => prefetchQuery(key));
              observer.disconnect();
            }
          });
        },
        { rootMargin: '100px' }
      );
      
      observer.observe(element);
    }
  };
}
