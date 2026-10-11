export type ReceiptFlowSnapshot = { userId: string | null; revision: number };

function createUuid(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID.call(globalThis.crypto);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export function createReceiptFlowState(makeId: () => string = createUuid) {
  let current: ReceiptFlowSnapshot = { userId: null, revision: 0 };
  const submissionIds = new Map<string, string>();

  return {
    transitionTo(userId: string | null): ReceiptFlowSnapshot {
      if (current.userId !== userId) {
        current = { userId, revision: current.revision + 1 };
        submissionIds.clear();
      }
      return current;
    },
    snapshot(): ReceiptFlowSnapshot {
      return current;
    },
    isCurrent(snapshot: ReceiptFlowSnapshot): boolean {
      return snapshot.userId !== null
        && current.userId === snapshot.userId
        && current.revision === snapshot.revision;
    },
    submissionIdFor(draftId: string): string {
      if (!current.userId) throw new Error('Sign in to submit a receipt.');
      const existing = submissionIds.get(draftId);
      if (existing) return existing;
      const id = makeId();
      submissionIds.set(draftId, id);
      return id;
    },
  };
}

export function formatReceiptTotal(totalMinor: number | null): string {
  return totalMinor === null ? '' : (totalMinor / 100).toFixed(2);
}

export function parseReceiptTotal(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}
