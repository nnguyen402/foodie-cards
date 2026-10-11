import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { boardRequestKey, createBoardRequestGate } from './board-requests';
import { loadProfileBoard } from './load-board';
import type { ProfileBoard } from './board';

type BoardState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; userId: string; board: ProfileBoard }
  | { status: 'error'; userId: string; message: string };

export function useProfileBoard(userId: string, equippedTitleKey: string | null) {
  const [state, setState] = useState<BoardState>({ status: 'loading' });
  const gate = useRef(createBoardRequestGate());

  const load = useCallback(async (force: boolean) => {
    if (!userId) {
      gate.current.cancel();
      setState({ status: 'idle' });
      return;
    }
    const request = gate.current.begin(boardRequestKey(userId, equippedTitleKey), force);
    if (!request) return;
    setState((current) => current.status === 'ready' && current.userId === userId ? current : { status: 'loading' });
    try {
      const board = await loadProfileBoard(userId, equippedTitleKey);
      if (!gate.current.isCurrent(request)) return;
      setState({ status: 'ready', userId, board });
    } catch (error) {
      if (!gate.current.isCurrent(request)) return;
      setState({
        status: 'error',
        userId,
        message: error instanceof Error && error.message ? error.message : 'Your profile details could not be loaded.',
      });
    } finally {
      gate.current.finish(request);
    }
  }, [equippedTitleKey, userId]);

  useFocusEffect(useCallback(() => {
    void load(false);
  }, [load]));

  const refresh = useCallback(() => load(true), [load]);

  const visible = state.status === 'ready' || state.status === 'error'
    ? (state.userId === userId ? state : { status: 'loading' as const })
    : state;
  return { state: visible, refresh };
}
