import { avatarKeySchema, type Profile } from '@foodie-cards/shared';

export const avatarKeys = avatarKeySchema.options;

export const avatarLabels: Record<Profile['avatarKey'], string> = {
  fork: 'Fork',
  plate: 'Plate',
  bowl: 'Bowl',
  noodles: 'Noodles',
  taco: 'Taco',
  donut: 'Donut',
};
