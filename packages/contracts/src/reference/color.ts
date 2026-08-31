import { z } from 'zod';

/**
 * Color tokens map to design-system semantic tokens (see packages/ui tokens.css).
 * Only these values are accepted for account/category colors (FR reference catalog).
 */
export const colorTokenSchema = z.enum([
  'danger',
  'rose',
  'pink',
  'fuchsia',
  'purple',
  'violet',
  'indigo',
  'primary',
  'info',
  'sky',
  'cyan',
  'teal',
  'emerald',
  'success',
  'green',
  'lime',
  'yellow',
  'accent',
  'warning',
  'amber',
  'orange',
  'stone',
  'slate',
  // Roda espectral (24 tons) — paleta do seletor de cor
  'red',
  'red-orange',
  'orange-vivid',
  'orange-yellow',
  'yellow-vivid',
  'yellow-green',
  'lime-vivid',
  'green-lime',
  'green-vivid',
  'emerald-vivid',
  'teal-vivid',
  'teal-cyan',
  'cyan-vivid',
  'blue-cyan',
  'blue',
  'blue-indigo',
  'indigo-vivid',
  'indigo-violet',
  'violet-vivid',
  'violet-magenta',
  'magenta',
  'magenta-pink',
  'pink-vivid',
  'pink-red',
]);

export type ColorToken = z.infer<typeof colorTokenSchema>;

export interface ColorOption {
  token: ColorToken;
  label: string;
}

export const COLORS: readonly ColorOption[] = [
  { token: 'red', label: 'Vermelho' },
  { token: 'red-orange', label: 'Vermelho-alaranjado' },
  { token: 'orange-vivid', label: 'Laranja' },
  { token: 'orange-yellow', label: 'Laranja-amarelado' },
  { token: 'yellow-vivid', label: 'Amarelo' },
  { token: 'yellow-green', label: 'Amarelo-esverdeado' },
  { token: 'lime-vivid', label: 'Verde-limão' },
  { token: 'green-lime', label: 'Verde-amarelado' },
  { token: 'green-vivid', label: 'Verde' },
  { token: 'emerald-vivid', label: 'Verde-esmeralda' },
  { token: 'teal-vivid', label: 'Turquesa' },
  { token: 'teal-cyan', label: 'Turquesa-ciano' },
  { token: 'cyan-vivid', label: 'Ciano' },
  { token: 'blue-cyan', label: 'Azul-ciano' },
  { token: 'blue', label: 'Azul' },
  { token: 'blue-indigo', label: 'Azul-índigo' },
  { token: 'indigo-vivid', label: 'Índigo' },
  { token: 'indigo-violet', label: 'Índigo-violeta' },
  { token: 'violet-vivid', label: 'Violeta' },
  { token: 'violet-magenta', label: 'Violeta-magenta' },
  { token: 'magenta', label: 'Magenta / Vinho' },
  { token: 'magenta-pink', label: 'Magenta-rosa' },
  { token: 'pink-vivid', label: 'Rosa / Fúcsia' },
  { token: 'pink-red', label: 'Rosa-avermelhado' },
] as const;

export const COLOR_TOKENS: readonly ColorToken[] = COLORS.map((c) => c.token);

export function isColorToken(value: string): value is ColorToken {
  return colorTokenSchema.safeParse(value).success;
}
