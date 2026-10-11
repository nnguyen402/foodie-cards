import { cuisineKeyFor, type CuisineKey } from '../cards/cuisineArt';

/** The art token for the Unlocking banner: generic food words in the place's name, else 'default' (drawn icon). */
export function bannerCuisine(name: string): CuisineKey {
  return cuisineKeyFor({ name });
}
