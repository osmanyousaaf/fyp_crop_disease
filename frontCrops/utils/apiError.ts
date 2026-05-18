import axios from 'axios';

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as Record<string, unknown> | undefined;
    if (d && typeof d === 'object') {
      const msg = d.msg ?? d.message ?? d.error;
      if (typeof msg === 'string' && msg.trim()) return msg;
      if (typeof d.details === 'string' && d.details.trim()) return d.details;
    }
    if (err.message?.trim()) return err.message;
    if (err.response?.status === 401) return 'Wrong email or password.';
    if (err.response?.status === 409) return 'An account with this email already exists.';
    if (err.response?.status === 403) return 'Please verify your email before signing in.';
    if (err.response?.status === 404) return 'No account found for this email.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
