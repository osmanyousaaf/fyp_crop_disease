/** Formal light UI — white surfaces, jet gray typography & accents. No gradients. */
export const COLORS = {
  bg: '#FFFFFF',
  bgMuted: '#F9FAFB',
  bgSubtle: '#F3F4F6',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  jet: '#111827',
  jetMuted: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  white: '#FFFFFF',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
  errorText: '#991B1B',
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',
  successText: '#166534',
} as const;

/** @deprecated — gradients removed from UI */
export const APP_SCREEN_GRADIENT = ['#FFFFFF', '#FFFFFF'] as const;
