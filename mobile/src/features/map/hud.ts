// Account level is 1 + floor(accountXP / 200) (docs/foodie-cards-plan.md). The level itself
// comes from the profile; this only works out how far into that level the bar should sit.
const XP_PER_LEVEL = 200;

export function hudProgress(profile: { accountXP: number; accountLevel: number }, discovered: number, total: number) {
  const xpIntoLevel = profile.accountXP % XP_PER_LEVEL;
  return {
    level: profile.accountLevel,
    xpIntoLevel,
    xpPerLevel: XP_PER_LEVEL,
    fraction: xpIntoLevel / XP_PER_LEVEL,
    xpLabel: `Lv ${profile.accountLevel} · ${profile.accountXP} XP · ${xpIntoLevel}/${XP_PER_LEVEL} to Lv ${profile.accountLevel + 1}`,
    discoveredLabel: `${discovered} / ${total} discovered`,
  };
}
