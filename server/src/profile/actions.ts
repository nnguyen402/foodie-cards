import {
  equipTitleRequestSchema,
  equipTitleResponseSchema,
  profileEditRequestSchema,
  profileEditResponseSchema,
  profilePinsRequestSchema,
  profilePinsResponseSchema,
  profileSchema,
  type ApiErrorCode,
  type EquipTitleResponse,
  type ProfileEditResponse,
  type ProfilePinsResponse,
} from '@foodie-cards/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type ProfileActionFailureCode = Extract<ApiErrorCode, 'INVALID_REQUEST' | 'NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL_ERROR'>;

export class ProfileActionError extends Error {
  readonly code: ProfileActionFailureCode;
  readonly status: number;
  readonly retryable = false;

  constructor(code: ProfileActionFailureCode, message: string, status: number) {
    super(message);
    this.name = 'ProfileActionError';
    this.code = code;
    this.status = status;
  }
}

function invalidRequest(): ProfileActionError {
  return new ProfileActionError('INVALID_REQUEST', 'The profile request is invalid.', 400);
}

function rpcFailure(
  error: { code?: string; message?: string } | null,
  forbiddenMessage = 'That profile change is not allowed.',
  forbiddenCode: 'FORBIDDEN' | 'NOT_FOUND' = 'FORBIDDEN',
): ProfileActionError {
  switch (error?.code) {
    case 'P0002':
      return new ProfileActionError('NOT_FOUND', 'Profile not found.', 404);
    case '42501':
      return forbiddenCode === 'NOT_FOUND' && error?.message?.startsWith('FORBIDDEN:')
        ? new ProfileActionError('NOT_FOUND', 'The requested item was not found.', 404)
        : new ProfileActionError('FORBIDDEN', forbiddenMessage, 403);
    case '22023':
    case '23503':
    case '23514':
      return invalidRequest();
    default:
      return new ProfileActionError('INTERNAL_ERROR', 'The profile could not be updated right now.', 500);
  }
}

function parseProfileRow(userId: string, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProfileActionError('INTERNAL_ERROR', 'The profile could not be updated right now.', 500);
  }
  const row = value as Record<string, unknown>;
  const accountXP = row.account_xp;
  const parsed = profileSchema.safeParse({
    userId,
    displayName: row.display_name,
    avatarKey: row.avatar_key,
    accountXP,
    accountLevel: typeof accountXP === 'number' ? 1 + Math.floor(accountXP / 200) : NaN,
    equippedTitleKey: row.equipped_title_key,
  });
  if (!parsed.success) {
    throw new ProfileActionError('INTERNAL_ERROR', 'The profile could not be updated right now.', 500);
  }
  return parsed.data;
}

export function createProfileActions(supabaseClient: SupabaseClient) {
  return {
    async editProfile(userId: string, input: unknown): Promise<ProfileEditResponse> {
      const request = profileEditRequestSchema.safeParse(input);
      if (!userId || !request.success) throw invalidRequest();

      const { data, error } = await supabaseClient.rpc('edit_profile', {
        p_user_id: userId,
        p_display_name: request.data.displayName,
        p_avatar_key: request.data.avatarKey,
      });
      if (error) throw rpcFailure(error);

      const response = profileEditResponseSchema.safeParse({
        profile: parseProfileRow(userId, data),
      });
      if (!response.success) {
        throw new ProfileActionError('INTERNAL_ERROR', 'The profile could not be updated right now.', 500);
      }
      return response.data;
    },

    async setPins(userId: string, input: unknown): Promise<ProfilePinsResponse> {
      const request = profilePinsRequestSchema.safeParse(input);
      if (!userId || !request.success) throw invalidRequest();

      const { data, error } = await supabaseClient.rpc('set_profile_pins', {
        p_user_id: userId,
        p_pins: request.data.pins,
      });
      if (error) throw rpcFailure(error, 'Only cards you own can be pinned.', 'NOT_FOUND');

      const response = profilePinsResponseSchema.safeParse(data);
      if (!response.success) {
        throw new ProfileActionError('INTERNAL_ERROR', 'The pins could not be updated right now.', 500);
      }
      return response.data;
    },

    async equipTitle(userId: string, input: unknown): Promise<EquipTitleResponse> {
      const request = equipTitleRequestSchema.safeParse(input);
      if (!userId || !request.success) throw invalidRequest();

      const { data, error } = await supabaseClient.rpc('equip_title', {
        p_user_id: userId,
        p_title_key: request.data.titleKey,
      });
      if (error) throw rpcFailure(error, 'That title is not unlocked.', 'NOT_FOUND');

      const response = equipTitleResponseSchema.safeParse(data);
      if (!response.success) {
        throw new ProfileActionError('INTERNAL_ERROR', 'The title could not be updated right now.', 500);
      }
      return response.data;
    },
  };
}

export type ProfileActions = ReturnType<typeof createProfileActions>;
