import { describe, expect, it, vi } from 'vitest';
import { createProfileActions, ProfileActionError } from '../src/profile/actions.ts';

const validProfileRow = {
  id: 'user-1',
  display_name: 'Nora',
  avatar_key: 'plate',
  account_xp: 450,
  equipped_title_key: null,
};

function actionsFor(rpc: ReturnType<typeof vi.fn>) {
  return createProfileActions({ rpc } as never);
}

describe('profile action adapter', () => {
  it('validates and maps profile edits through the service RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: validProfileRow, error: null });
    const actions = actionsFor(rpc);

    await expect(actions.editProfile('user-1', { displayName: ' Nora ', avatarKey: 'plate' })).resolves.toEqual({
      profile: {
        userId: 'user-1', displayName: 'Nora', avatarKey: 'plate',
        accountXP: 450, accountLevel: 3, equippedTitleKey: null,
      },
    });
    expect(rpc).toHaveBeenCalledWith('edit_profile', {
      p_user_id: 'user-1', p_display_name: 'Nora', p_avatar_key: 'plate',
    });
  });

  it('rejects fields outside the profile edit contract before calling the database', async () => {
    const rpc = vi.fn();
    const actions = actionsFor(rpc);

    await expect(actions.editProfile('user-1', { displayName: 'Nora', avatarKey: 'plate', accountXP: 999 }))
      .rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('replaces pins using only the validated pin contract', async () => {
    const pins = [{ cardId: 'card-1', slot: 1 }];
    const rpc = vi.fn().mockResolvedValue({ data: { pins }, error: null });
    const actions = actionsFor(rpc);

    await expect(actions.setPins('user-1', { pins })).resolves.toEqual({ pins });
    expect(rpc).toHaveBeenCalledWith('set_profile_pins', { p_user_id: 'user-1', p_pins: pins });
  });

  it('allows clearing an equipped title', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { equippedTitleKey: null }, error: null });
    const actions = actionsFor(rpc);

    await expect(actions.equipTitle('user-1', { titleKey: null })).resolves.toEqual({ equippedTitleKey: null });
    expect(rpc).toHaveBeenCalledWith('equip_title', { p_user_id: 'user-1', p_title_key: null });
  });

  it('maps database authorization failures to safe messages', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'FORBIDDEN: title is not unlocked; internal row details' },
    });
    const actions = actionsFor(rpc);

    await expect(actions.equipTitle('user-1', { titleKey: null })).rejects.toMatchObject({
      code: 'NOT_FOUND', message: 'The requested item was not found.',
    });
    expect(rpc).toHaveBeenCalledOnce();
  });
});
