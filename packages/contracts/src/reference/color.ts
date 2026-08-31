import { z } from 'zod';

/**
 * Color tokens map to design-system semantic tokens (see packages/ui tokens.css).
 * Only these values are accepted for account/category colors (FR reference catalog).
 */
export const colorTokenSchema = z.enum([
  'primary',
  'accent',
  'success',
  'danger',
  'warning',
  'info',
  'orange',
  'teal',
  'indigo',
  'pink',
  'lime',
  'emerald',
  'sky',
  'fuchsia',
  'slate',
  'rose',
  'amber',
  'yellow',
  'green',
  'cyan',
  'violet',
  'purple',
  'stone',
]);

export type ColorToken = z.infer<typeof colorTokenSchema>;

export interface ColorOption {
  token: ColorToken;
  label: string;
}

export const COLORS: readonly ColorOption[] = [
  { token: 'primary', label: 'Azul' },
  { token: 'accent', label: 'Roxo' },
  { token: 'success', label: 'Verde' },
  { token: 'danger', label: 'Vermelho' },
  { token: 'warning', label: 'Amarelo' },
  { token: 'info', label: 'Ciano' },
  { token: 'orange', label: 'Laranja' },
  { token: 'teal', label: 'Turquesa' },
  { token: 'indigo', label: 'Índigo' },
  { token: 'pink', label: 'Rosa' },
  { token: 'lime', label: 'Lima' },
  { token: 'emerald', label: 'Esmeralda' },
  { token: 'sky', label: 'Azul-céu' },
  { token: 'fuchsia', label: 'Fúcsia' },
  { token: 'slate', label: 'Cinza' },
  { token: 'rose', label: 'Rosé' },
  { token: 'amber', label: 'Âmbar' },
  { token: 'yellow', label: 'Ouro' },
  { token: 'green', label: 'Verde-mata' },
  { token: 'cyan', label: 'Ciano-claro' },
  { token: 'violet', label: 'Violeta' },
  { token: 'purple', label: 'Púrpura' },
  { token: 'stone', label: 'Pedra' },
] as const;

export const COLOR_TOKENS: readonly ColorToken[] = COLORS.map((c) => c.token);

export function isColorToken(value: string): value is ColorToken {
  return colorTokenSchema.safeParse(value).success;
}
