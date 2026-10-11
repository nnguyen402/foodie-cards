import { describe, expect, it } from 'vitest';
import { createReceiptFlowState, formatReceiptTotal, parseReceiptTotal } from '../src/features/receipts/receipt-state';

describe('receipt flow state', () => {
  it('reuses one submission ID for retries of the same draft', () => {
    const flow = createReceiptFlowState(() => '10000000-0000-4000-8000-000000000001');
    flow.transitionTo('user-a');

    const firstAttemptId = flow.submissionIdFor('draft-1');
    const retryId = flow.submissionIdFor('draft-1');

    expect(firstAttemptId).toBe('10000000-0000-4000-8000-000000000001');
    expect(retryId).toBe(firstAttemptId);
  });

  it('invalidates a late draft response when account changes', () => {
    let next = 0;
    const flow = createReceiptFlowState(() => `10000000-0000-4000-8000-${String(++next).padStart(12, '0')}`);
    const request = flow.transitionTo('user-a');
    const userASubmissionId = flow.submissionIdFor('draft-1');
    flow.transitionTo('user-b');

    expect(flow.isCurrent(request)).toBe(false);
    expect(flow.submissionIdFor('draft-1')).not.toBe(userASubmissionId);
  });

  it('clears the draft submission identity after sign-out, even if the same account signs in again', () => {
    let next = 0;
    const flow = createReceiptFlowState(() => `10000000-0000-4000-8000-${String(++next).padStart(12, '0')}`);
    flow.transitionTo('user-a');
    const beforeSignOut = flow.submissionIdFor('draft-1');
    flow.transitionTo(null);
    flow.transitionTo('user-a');

    expect(flow.submissionIdFor('draft-1')).not.toBe(beforeSignOut);
  });

  it('converts user-facing dollar text to exact cents without accepting ambiguous values', () => {
    expect(parseReceiptTotal('64.72')).toBe(6472);
    expect(parseReceiptTotal('0')).toBe(0);
    expect(parseReceiptTotal('1.234')).toBeNull();
    expect(parseReceiptTotal('-1.00')).toBeNull();
    expect(formatReceiptTotal(6472)).toBe('64.72');
    expect(formatReceiptTotal(null)).toBe('');
  });
});
