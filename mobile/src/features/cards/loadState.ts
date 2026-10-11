// Whether an incoming load result may replace what is stored. A failed refetch never replaces ready data.
export function shouldStore<S extends { status: string }>(args: {
  isLatest: boolean;
  previous: S | null;
  incoming: S;
}): boolean {
  if (!args.isLatest) return false;
  return !(args.incoming.status === 'error' && args.previous?.status === 'ready');
}

// Orders overlapping loads: only the newest request may store its result, and changing the key
// (for example the signed-in user) invalidates everything still in flight.
export function createRequestTracker(initialKey = '') {
  let counter = 0;
  let key = initialKey;
  return {
    next(): number {
      return ++counter;
    },
    isLatest(token: number): boolean {
      return token === counter;
    },
    reset(nextKey: string): void {
      if (nextKey === key) return;
      key = nextKey;
      counter++;
    },
  };
}
