import { z } from 'zod';

/**
 * Static catalog of supported banks. `id` is the stable reference stored on
 * accounts; `color` is the brand color used by the UI BankSelect swatch.
 */
export interface Bank {
  id: string;
  name: string;
  color: string;
}

export const BANKS: readonly Bank[] = [
  { id: 'nubank', name: 'Nubank', color: '#820AD1' },
  { id: 'itau', name: 'Itaú', color: '#EC7000' },
  { id: 'bradesco', name: 'Bradesco', color: '#CC092F' },
  { id: 'santander', name: 'Santander', color: '#EC0000' },
  { id: 'banco-do-brasil', name: 'Banco do Brasil', color: '#FAE128' },
  { id: 'caixa', name: 'Caixa Econômica', color: '#005CA9' },
  { id: 'inter', name: 'Inter', color: '#FF7A00' },
  { id: 'c6', name: 'C6 Bank', color: '#242424' },
  { id: 'btg', name: 'BTG Pactual', color: '#001E62' },
  { id: 'original', name: 'Original', color: '#00A868' },
  { id: 'next', name: 'Next', color: '#00FF5F' },
  { id: 'picpay', name: 'PicPay', color: '#11C76F' },
  { id: 'mercado-pago', name: 'Mercado Pago', color: '#009EE3' },
  { id: 'sicoob', name: 'Sicoob', color: '#003641' },
  { id: 'sicredi', name: 'Sicredi', color: '#3FA110' },
  { id: 'safra', name: 'Safra', color: '#00263A' },
  { id: 'pagbank', name: 'PagBank', color: '#00A868' },
  { id: 'neon', name: 'Neon', color: '#00E0FF' },
  { id: 'will', name: 'Will Bank', color: '#FFD400' },
  { id: 'other', name: 'Outro', color: '#64748B' },
] as const;

export const BANK_IDS: readonly string[] = BANKS.map((b) => b.id);

export const bankSchema = z
  .string()
  .refine((id) => BANK_IDS.includes(id), 'Unknown bank id');

export type BankId = string;

export function findBank(id: string): Bank | undefined {
  return BANKS.find((b) => b.id === id);
}

export function isBankId(value: string): boolean {
  return BANK_IDS.includes(value);
}
