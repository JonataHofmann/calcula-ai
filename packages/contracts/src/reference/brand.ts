import { z } from 'zod';

/**
 * Static catalog of credit-card brands. `logo` is a stable key the UI may use to
 * render a brand mark; `color` is the brand color for the card visual.
 */
export interface CardBrand {
  id: string;
  name: string;
  color: string;
  logo: string;
}

export const CARD_BRANDS: readonly CardBrand[] = [
  { id: 'visa', name: 'Visa', color: '#1A1F71', logo: 'visa' },
  { id: 'mastercard', name: 'Mastercard', color: '#EB001B', logo: 'mastercard' },
  { id: 'elo', name: 'Elo', color: '#000000', logo: 'elo' },
  { id: 'amex', name: 'American Express', color: '#006FCF', logo: 'amex' },
  { id: 'hipercard', name: 'Hipercard', color: '#B3131B', logo: 'hipercard' },
  { id: 'diners', name: 'Diners Club', color: '#0079BE', logo: 'diners' },
  { id: 'discover', name: 'Discover', color: '#FF6000', logo: 'discover' },
  { id: 'jcb', name: 'JCB', color: '#0B4EA2', logo: 'jcb' },
  { id: 'other', name: 'Outra', color: '#64748B', logo: 'other' },
] as const;

export const CARD_BRAND_IDS: readonly string[] = CARD_BRANDS.map((b) => b.id);

export const brandSchema = z
  .string()
  .refine((id) => CARD_BRAND_IDS.includes(id), 'Unknown card brand id');

export type CardBrandId = string;

export function findCardBrand(id: string): CardBrand | undefined {
  return CARD_BRANDS.find((b) => b.id === id);
}

export function isCardBrandId(value: string): boolean {
  return CARD_BRAND_IDS.includes(value);
}
