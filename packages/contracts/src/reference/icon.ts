import { z } from 'zod';

/**
 * Icon keys are kebab-case lucide-react icon names. The UI IconPicker maps each
 * key to its lucide component. Keep keys in sync with the picker's icon map.
 */
export const ICON_KEYS = [
  'utensils',
  'shopping-cart',
  'shopping-bag',
  'house',
  'car',
  'plane',
  'bus',
  'train-front',
  'fuel',
  'heart-pulse',
  'stethoscope',
  'pill',
  'dumbbell',
  'graduation-cap',
  'book',
  'briefcase',
  'laptop',
  'wifi',
  'smartphone',
  'gift',
  'shirt',
  'baby',
  'dog',
  'cat',
  'coffee',
  'wine',
  'beer',
  'pizza',
  'banknote',
  'wallet',
  'piggy-bank',
  'credit-card',
  'landmark',
  'trending-up',
  'trending-down',
  'receipt',
  'hand-coins',
  'film',
  'music',
  'gamepad-2',
  'tv',
  'ticket',
  'palette',
  'camera',
  'bed',
  'map-pin',
  'wrench',
  'lightbulb',
  'droplet',
  'flame',
  'leaf',
  'sun',
  'umbrella',
  'sparkles',
  'star',
  'tag',
  'package',
  'truck',
  'bike',
  'heart',
] as const;

export const iconKeySchema = z.enum(ICON_KEYS);

export type IconKey = z.infer<typeof iconKeySchema>;

export interface IconOption {
  key: IconKey;
  /** Human label used by the picker search. */
  label: string;
}

export const ICONS: readonly IconOption[] = ICON_KEYS.map((key) => ({
  key,
  label: key.replace(/-/g, ' '),
}));

export function isIconKey(value: string): value is IconKey {
  return iconKeySchema.safeParse(value).success;
}
