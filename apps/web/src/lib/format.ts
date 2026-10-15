const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

export const displayName = (person: { name: string | null } | null | undefined): string =>
  person?.name ?? 'Unnamed user';

export function formatLabel(value: string): string {
  const text = value.replaceAll('_', ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}