const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

export const displayName = (person: { name: string | null } | null | undefined): string =>
  person?.name ?? 'Unnamed user';