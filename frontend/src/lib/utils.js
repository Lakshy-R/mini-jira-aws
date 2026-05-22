import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getInitials(name = '') {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  'bg-indigo-500/20 text-indigo-300 ring-indigo-500/20',
  'bg-violet-500/20 text-violet-300 ring-violet-500/20',
  'bg-teal-500/20 text-teal-300 ring-teal-500/20',
  'bg-amber-500/20 text-amber-300 ring-amber-500/20',
  'bg-rose-500/20 text-rose-300 ring-rose-500/20',
  'bg-sky-500/20 text-sky-300 ring-sky-500/20',
  'bg-emerald-500/20 text-emerald-300 ring-emerald-500/20',
  'bg-orange-500/20 text-orange-300 ring-orange-500/20',
  'bg-cyan-500/20 text-cyan-300 ring-cyan-500/20',
  'bg-pink-500/20 text-pink-300 ring-pink-500/20',
];

export function getAvatarColor(str = '') {
  const code = str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDeadline(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diffDays = Math.ceil((d - now) / 86400000);
  if (diffDays < 0)   return { label: `${Math.abs(diffDays)}d overdue`, variant: 'overdue' };
  if (diffDays === 0) return { label: 'Due today', variant: 'today' };
  if (diffDays <= 3)  return { label: `${diffDays}d left`, variant: 'soon' };
  return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), variant: 'normal' };
}
