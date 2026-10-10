export type SessionSnapshot = { userId: string | null; revision: number };

export function createSessionScope() {
  let current: SessionSnapshot = { userId: null, revision: 0 };

  return {
    transitionTo(userId: string | null): SessionSnapshot {
      current = { userId, revision: current.revision + 1 };
      return current;
    },
    isCurrent(snapshot: SessionSnapshot): boolean {
      return snapshot.userId !== null
        && current.userId === snapshot.userId
        && current.revision === snapshot.revision;
    },
  };
}
