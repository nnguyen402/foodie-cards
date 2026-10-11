/** Account XP required for each level. Matches `accountLevel = 1 + floor(accountXP / 200)`. */
export const ACCOUNT_XP_PER_LEVEL = 200;

export type LevelProgress = {
  xpIntoLevel: number;
  xpPerLevel: number;
  nextLevel: number;
};

export function levelProgress(accountXP: number, accountLevel: number): LevelProgress {
  const xp = Number.isFinite(accountXP) ? Math.max(0, Math.floor(accountXP)) : 0;
  const level = Number.isFinite(accountLevel) ? Math.max(1, Math.floor(accountLevel)) : 1;
  return {
    xpIntoLevel: xp % ACCOUNT_XP_PER_LEVEL,
    xpPerLevel: ACCOUNT_XP_PER_LEVEL,
    nextLevel: level + 1,
  };
}
