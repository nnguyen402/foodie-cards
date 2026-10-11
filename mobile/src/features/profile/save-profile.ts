import { profileEditRequestSchema, type ProfileEditRequest } from '@foodie-cards/shared';

/** Columns the signed-in user may update. Account XP and titles are excluded. */
export function profileColumnUpdate(input: ProfileEditRequest): { display_name: string; avatar_key: ProfileEditRequest['avatarKey'] } {
  const parsed = profileEditRequestSchema.parse(input);
  return { display_name: parsed.displayName, avatar_key: parsed.avatarKey };
}
