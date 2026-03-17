import { lazy, ComponentType, LazyExoticComponent } from 'react';

type LazyComponent<T extends ComponentType<any>> = LazyExoticComponent<T>;

const componentCache = new Map<string, LazyComponent<any>>();

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  name?: string
): LazyExoticComponent<T> {
  const cacheKey = name || factory.toString();
  
  if (componentCache.has(cacheKey)) {
    return componentCache.get(cacheKey)!;
  }

  const lazyComponent = lazy(() =>
    factory().catch((error) => {
      console.error(`Failed to load component ${name || 'unknown'}:`, error);
      return factory();
    })
  );

  componentCache.set(cacheKey, lazyComponent);
  return lazyComponent;
}

export function preloadComponent(factory: () => Promise<any>): void {
  factory().catch(() => {});
}

export const routePrefetchMap: Map<string, () => Promise<any>> = new Map();

export function registerPrefetch(path: string, factory: () => Promise<any>): void {
  routePrefetchMap.set(path, factory);
}

export function prefetchRoute(path: string): void {
  const factory = routePrefetchMap.get(path);
  if (factory) {
    factory().catch(() => {});
  }
}

export function createImagePreloader() {
  const preloaded = new Set<string>();
  
  return {
    preload(src: string) {
      if (preloaded.has(src)) return;
      preloaded.add(src);
      const img = new Image();
      img.src = src;
    },
    preloadMultiple(srcs: string[]) {
      srcs.forEach(src => this.preload(src));
    }
  };
}

export const imagePreloader = createImagePreloader();

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function measureRenderTime(componentName: string) {
  if (typeof window === 'undefined') return { start: () => {}, end: () => {} };
  
  const key = `render_${componentName}_${Date.now()}`;
  return {
    start: () => performance.mark(`${key}_start`),
    end: () => {
      performance.mark(`${key}_end`);
      performance.measure(componentName, `${key}_start`, `${key}_end`);
      const entries = performance.getEntriesByName(componentName);
      if (entries.length > 0) {
        console.debug(`[Perf] ${componentName}: ${entries[entries.length - 1].duration.toFixed(2)}ms`);
      }
    }
  };
}

export function getPerformanceMetrics() {
  if (typeof window === 'undefined') return null;
  
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!navigation) return null;

  return {
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    ttfb: navigation.responseStart - navigation.requestStart,
    download: navigation.responseEnd - navigation.responseStart,
    domInteractive: navigation.domInteractive - navigation.responseEnd,
    domComplete: navigation.domComplete - navigation.responseEnd,
    loadEvent: navigation.loadEventEnd - navigation.loadEventStart,
    totalPageLoad: navigation.loadEventEnd - navigation.startTime
  };
}

export function reportWebVitals(onReport: (metric: { name: string; value: number }) => void) {
  if (typeof window === 'undefined') return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint') {
        onReport({ name: 'LCP', value: entry.startTime });
      }
      if (entry.entryType === 'first-input') {
        const fid = entry as PerformanceEventTiming;
        onReport({ name: 'FID', value: fid.processingStart - fid.startTime });
      }
      if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
        onReport({ name: 'CLS', value: (entry as any).value });
      }
    }
  });

  try {
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    observer.observe({ type: 'first-input', buffered: true });
    observer.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
  }
}
