import type { ComponentType } from 'react';
import type { Profile } from '@foodie-cards/shared';
import { NoodleAvatar } from './NoodleAvatar';

export type AvatarKey = Profile['avatarKey'];
export type AvatarArtProps = { size: number };

/**
 * Drawn avatar illustrations by avatar key. A key without an entry falls back to the plain
 * label avatar, so new drawings can be added one at a time.
 */
export const avatarArt: Partial<Record<AvatarKey, ComponentType<AvatarArtProps>>> = {
  noodles: NoodleAvatar,
};

export function avatarArtFor(key: AvatarKey): ComponentType<AvatarArtProps> | null {
  return avatarArt[key] ?? null;
}
