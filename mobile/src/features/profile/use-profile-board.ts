import { useCallback, useEffect, useRef, useState } from 'react';
import { loadProfileBoard } from './load-board';
import type { ProfileBoard } from './board';

type BoardState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; userId: string; board: ProfileBoard }
  | { status: 'error'; userId: string; message: string };

export function useProfileBoard(userId: string, equippedTitleKey: string | null) {
  const [state, setState] = useState<BoardState>({ status: 'loading' });
  const request = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({ status: 'idle' });
      return;
    }
    const token = ++request.current;
    setState((current) => current.status === 'ready' && current.userId === userId ? current : { status: 'loading' });
    try {
      const board = await loadProfileBoard(userId, equippedTitleKey);
      if (token !== request.current) return;
      setState({ status: 'ready', userId, board });
    } catch (error) {
      if (token !== request.current) return;
      setState({
        status: 'error',
        userId,
        message: error instanceof Error && error.message ? error.message : 'Your profile details could not be loaded.',
      });
    }
  }, [equippedTitleKey, userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const visible = state.status === 'ready' || state.status === 'error'
    ? (state.userId === userId ? state : { status: 'loading' as const })
    : state;
  return { state: visible, refresh };
}
