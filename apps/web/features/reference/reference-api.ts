import type { Bank, CardBrand, IconOption, ColorOption } from '@finance/contracts';
import { apiFetch } from '../../services/api-client';

export function getBanks(): Promise<{ banks: Bank[] }> {
  return apiFetch('/reference/banks');
}

export function getBrands(): Promise<{ brands: CardBrand[] }> {
  return apiFetch('/reference/brands');
}

export function getIcons(): Promise<{ icons: IconOption[] }> {
  return apiFetch('/reference/icons');
}

export function getColors(): Promise<{ colors: ColorOption[] }> {
  return apiFetch('/reference/colors');
}
