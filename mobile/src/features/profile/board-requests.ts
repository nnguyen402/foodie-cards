export type BoardRequest = { id: number; key: string };

export function boardRequestKey(userId: string, equippedTitleKey: string | null): string {
  return JSON.stringify([userId, equippedTitleKey]);
}

/**
 * Focus refreshes reuse a matching in-flight request; forced refreshes replace it.
 * Only the most recently started request may publish its result.
 */
export function createBoardRequestGate() {
  let latestId = 0;
  let inFlight: BoardRequest | null = null;

  return {
    begin(key: string, force: boolean): BoardRequest | null {
      if (!force && inFlight?.key === key) return null;
      const request = { id: ++latestId, key };
      inFlight = request;
      return request;
    },
    isCurrent(request: BoardRequest): boolean {
      return request.id === latestId;
    },
    finish(request: BoardRequest): void {
      if (inFlight?.id === request.id) inFlight = null;
    },
    cancel(): void {
      latestId += 1;
      inFlight = null;
    },
  };
}
