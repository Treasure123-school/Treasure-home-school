import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "@/config/api";

// Circuit Breaker Pattern for API requests
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold = 5;
  private readonly timeout = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        const error = new Error('Circuit breaker is OPEN - service temporarily unavailable') as ClassifiedError;
        error.errorType = 'server';
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: any) {
      // Only count certain error types as failures for circuit breaker
      if (this.shouldCountAsFailure(error)) {
        this.onFailure();
      }
      throw error;
    }
  }

  private shouldCountAsFailure(error: ClassifiedError): boolean {
    // Don't count client errors (4xx) toward circuit breaker failures
    if (error.errorType === 'client' || error.errorType === 'auth') {
      return false;
    }
    // Count network, timeout, and server errors
    return (
      error.errorType === 'network' ||
      error.errorType === 'timeout' ||
      error.errorType === 'server' ||
      !!error?.message?.match(/^(5\d\d|429):/) ||
      error?.name === 'NetworkError' ||
      error?.name === 'TypeError' ||
      error?.name === 'AbortError'
    );
  }
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
  reset() {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }
}

// Global circuit breaker for API requests
const apiCircuitBreaker = new CircuitBreaker();

// Global function to reset circuit breaker - useful when users encounter circuit breaker errors
export function resetCircuitBreaker() {
  apiCircuitBreaker.reset();
}
// Global function to get circuit breaker status
export function getCircuitBreakerStatus() {
  return apiCircuitBreaker.getState();
}
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Unified HTTP request function with proper error classification
async function makeRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  return apiCircuitBreaker.execute(async () => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};

    // Handle different data types appropriately
    if (data && !(data instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Create AbortController for request timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const res = await fetch(getApiUrl(url), {
        method,
        headers,
        body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for HTTP errors and classify them properly
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        const error = new Error(`${res.status}: ${text}`) as ClassifiedError;

        // Classify the error type based on HTTP status
        if (res.status === 401 || res.status === 403) {
          error.errorType = 'auth';
          // Auto logout on 401
          if (res.status === 401) {
            localStorage.removeItem('auth-user');
            localStorage.removeItem('token');
            localStorage.removeItem('last-activity');
            window.location.href = '/login';
          }
        } else if (res.status >= 400 && res.status < 500) {
          error.errorType = 'client';
        } else if (res.status >= 500 || res.status === 429) {
          error.errorType = 'server';
        }
        // Add specific properties for easier identification
        error.status = res.status;
        error.statusText = res.statusText;

        throw error;
      }
      return res;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Preserve original error properties while adding classification
      const classifiedError = error as ClassifiedError;
      classifiedError.originalError = error;

      // Classify network/timeout errors properly
      if (error.name === 'AbortError') {
        classifiedError.errorType = 'timeout';
        classifiedError.message = 'Request timeout - please try again';
      } else if (error.name === 'TypeError' || error.name === 'NetworkError' || 
                 error.message?.includes('fetch') || error.message?.includes('network')) {
        classifiedError.errorType = 'network';
        classifiedError.message = 'Network connection failed - please check your internet connection';
      }
      throw classifiedError;
    }
  });
}
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem('token');

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    // Add timeout to prevent hanging requests
    signal: AbortSignal.timeout(30000), // 30 second timeout
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.body = JSON.stringify(data);
  }
  try {
    const response = await fetch(getApiUrl(url), config);

    // For successful responses, return as-is
    if (response.ok) {
      return response;
    }
    // For error responses, check if we got JSON or HTML
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      // Server returned JSON error - return as-is for proper error handling
      return response;
    } else if (contentType?.includes('text/html')) {
      // Server returned HTML error page - convert to JSON
      const errorResponse = new Response(
        JSON.stringify({ 
          message: response.status === 401 
            ? 'Your session has expired. Please refresh the page and log in again.'
            : response.status === 500
            ? 'Internal server error. Please try again in a moment.'
            : `Server error (${response.status}). Please try again.`
        }),
        {
          status: response.status,
          statusText: response.statusText,
          headers: { 'content-type': 'application/json' }
        }
      );
      return errorResponse;
    } else {
      // Unknown response type
      const errorResponse = new Response(
        JSON.stringify({ 
          message: `Unexpected server response (${response.status}). Please try again.`
        }),
        {
          status: response.status,
          statusText: response.statusText,
          headers: { 'content-type': 'application/json' }
        }
      );
      return errorResponse;
    }
  } catch (error: any) {
    
    // Handle specific error types
    let errorMessage = 'Network connection failed. Please check your internet connection and try again.';
    let errorDetails = 'If you have internet access, the server might be temporarily unavailable. Please wait a moment and try again.';
    let statusCode = 0;
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request Timeout';
      errorDetails = 'The request took too long to complete. This might be due to a slow connection. Please try again with a better internet connection.';
      statusCode = 408;
    } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      errorMessage = 'Connection Failed';
      errorDetails = 'Unable to reach the server. Please check:\n• Your internet connection is active\n• You\'re not in offline mode\n• Try refreshing the page';
      statusCode = 0;
    }
    const networkErrorResponse = new Response(
      JSON.stringify({ message: errorMessage }),
      {
        status: statusCode,
        statusText: error.name || 'Network Error',
        headers: { 'content-type': 'application/json' }
      }
    );
    return networkErrorResponse;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      // Use the unified request function for queries too
      const res = await makeRequest('GET', queryKey.join("/") as string);
      return await res.json();
    } catch (error: any) {
      // Handle 401 errors according to the specified behavior
      if (unauthorizedBehavior === "returnNull" && 
          (error.errorType === 'auth' || error?.message?.includes('401'))) {
        return null;
      }
      throw error;
    }
  };

// Enhanced error classification for better error handling
interface ClassifiedError extends Error {
  errorType?: 'network' | 'timeout' | 'server' | 'client' | 'auth';
  originalError?: Error;
  status?: number;
  statusText?: string;
}
// Advanced retry strategy with proper error classification
const intelligentRetryFn = (failureCount: number, error: ClassifiedError) => {
  // Don't retry on authentication/authorization errors
  if (error.errorType === 'auth' || error?.message?.includes('401') || error?.message?.includes('403')) {
    return false;
  }
  // Don't retry on client-side validation errors
  if (error.errorType === 'client' || error?.message?.match(/^(400|404|409|422):/)) {
    return false;
  }
  // Retry on network errors, timeouts, server errors (5xx), and rate limiting (429)
  if (
    error.errorType === 'network' ||
    error.errorType === 'timeout' ||
    error.errorType === 'server' ||
    error?.message?.includes('Network request failed') ||
    error?.message?.includes('Request timeout') ||
    error?.message?.includes('Network connection failed') ||
    error?.message?.match(/^(5\d\d|429):/) ||
    error?.name === 'NetworkError' ||
    error?.name === 'TypeError' ||
    error?.name === 'AbortError'
  ) {
    // Maximum 3 retries for critical operations
    return failureCount < 3;
  }
  // Default: no retry for other errors
  return false;
};

// Exponential backoff delay calculation
const retryDelay = (attemptIndex: number) => {
  // Base delay: 500ms, doubles each attempt, with jitter
  const baseDelay = 500;
  const exponentialDelay = baseDelay * Math.pow(2, attemptIndex);
  const jitter = Math.random() * 200; // Add 0-200ms random jitter

  // Cap at 10 seconds maximum
  return Math.min(exponentialDelay + jitter, 10000);
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 30 * 1000, // 30 seconds - balance between freshness and performance
      gcTime: 10 * 60 * 1000, // 10 minutes - keep data in cache longer for navigation
      retry: intelligentRetryFn,
      retryDelay,
      networkMode: 'online',
      refetchOnReconnect: true,
    },
    mutations: {
      retry: intelligentRetryFn,
      retryDelay,
      networkMode: 'online',
    },
  },
});

export function invalidateQueries(queryKey: string[]) {
  return queryClient.invalidateQueries({ queryKey });
}