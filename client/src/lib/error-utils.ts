/**
 * Central error parsing utilities.
 * All user-facing error messages should flow through parseApiError() so the
 * app always shows consistent, human-readable feedback.
 */

/**
 * Converts any thrown error (from queries, mutations, or catch blocks) into a
 * clean, user-facing message. Never exposes raw stack traces or internal details.
 */
export function parseApiError(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  if (error instanceof Error) {
    const msg = error.message;
    const name = error.name;

    // ── Circuit breaker ───────────────────────────────────────────────────────
    if (msg.includes('Circuit breaker') || msg.includes('service temporarily unavailable')) {
      return 'The server is temporarily unavailable. Please try again in a moment.';
    }

    // ── Network / connection ──────────────────────────────────────────────────
    if (
      name === 'NetworkError' ||
      msg.includes('Network connection failed') ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('fetch failed')
    ) {
      return 'Network error. Please check your connection and try again.';
    }

    // ── Timeout ───────────────────────────────────────────────────────────────
    if (name === 'AbortError' || msg.includes('Request timeout') || msg.includes('timed out')) {
      return 'The request timed out. Please try again.';
    }

    // ── Already a clean user message (set by our makeRequest) ─────────────────
    // makeRequest now sets user-friendly messages directly on error.message.
    // If the message doesn't look like a raw HTTP dump just return it.
    if (msg && msg.length < 300 && !msg.match(/^\d{3}:/)) {
      return msg;
    }

    // ── Legacy "STATUS: {JSON}" format (fallback) ─────────────────────────────
    const statusMatch = msg.match(/^(\d{3}):\s*([\s\S]*)$/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      const body = statusMatch[2].trim();

      let serverMessage: string | undefined;
      try {
        const json = JSON.parse(body);
        serverMessage = json.message || json.error || undefined;
      } catch {
        // body isn't JSON — ignore
      }

      return mapStatusToMessage(status, serverMessage);
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Maps an HTTP status code + optional server-supplied message to a
 * user-friendly string.
 */
export function mapStatusToMessage(status: number, serverMessage?: string): string {
  if (status === 400) return serverMessage || 'Invalid request. Please check your inputs and try again.';
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return serverMessage || 'You don\'t have permission to perform this action.';
  if (status === 404) return serverMessage || 'The requested item was not found.';
  if (status === 408) return 'The request timed out. Please try again.';
  if (status === 409) return serverMessage || 'This action conflicts with existing data. Please refresh and try again.';
  if (status === 413) return 'The file you\'re uploading is too large. Please try a smaller file.';
  if (status === 422) return serverMessage || 'Invalid data submitted. Please check your inputs.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'A server error occurred. Please try again later.';
  if (serverMessage) return serverMessage;
  return `Request failed (${status}). Please try again.`;
}

/**
 * Reads an error HTTP response and returns a user-friendly string.
 * Use inside mutation functions after checking !response.ok.
 */
export async function extractResponseError(response: Response): Promise<string> {
  let serverMessage: string | undefined;
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await response.json();
      serverMessage = json.message || json.error || undefined;
    }
  } catch {
    // ignore parse failures
  }
  return mapStatusToMessage(response.status, serverMessage);
}

/**
 * Returns a user-friendly title for a toast given an HTTP status or error type.
 */
export function getErrorTitle(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('session') || error.message.includes('log in')) return 'Session Expired';
    if (error.message.includes('permission') || error.message.includes('access')) return 'Access Denied';
    if (error.message.includes('Network') || error.message.includes('connection')) return 'Connection Error';
    if (error.message.includes('timed out') || error.message.includes('timeout')) return 'Request Timed Out';
    if (error.message.includes('not found')) return 'Not Found';
    if (error.message.includes('server error')) return 'Server Error';
  }
  return 'Error';
}
