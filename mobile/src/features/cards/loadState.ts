// Whether an incoming load result may replace what is stored. A failed refetch never replaces ready data.
export function shouldStore<S extends { status: string }>(args: {
  isLatest: boolean;
  previous: S | null;
  incoming: S;
}): boolean {
  if (!args.isLatest) return false;
  return !(args.incoming.status === 'error' && args.previous?.status === 'ready');
}
