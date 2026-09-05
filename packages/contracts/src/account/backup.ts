import { z } from 'zod';

/**
 * Portable snapshot of a user's financial data (accounts, cards, custom categories,
 * transactions). System default categories (ownerId null) are never exported — they
 * exist on every deployment and are referenced by id. Dates are ISO strings; money
 * fields stay as decimal strings to avoid float rounding.
 */

export const backupAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  bankId: z.string(),
  icon: z.string(),
  color: z.string(),
});

export const backupCreditCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lastDigits: z.string(),
  dueDay: z.number().int(),
  closingDay: z.number().int(),
  limit: z.string(),
  brandId: z.string(),
});

/** Custom category (ownerId = the user). parentId null for roots. */
export const backupCategorySchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  name: z.string(),
  type: z.string(),
  icon: z.string(),
  color: z.string(),
});

/**
 * A user's copy-on-write override of a system default category's presentation (never its
 * type). `categoryId` is a system-default id — stable across deployments, so it is kept
 * verbatim on import (never remapped).
 */
export const backupCategoryOverrideSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
});

/**
 * A user's per-user reparent of a system default. `categoryId` is a system-default id
 * (verbatim). `parentId` null = promoted to root; a uuid nests it under that parent (which
 * may be a custom category from this snapshot, so it is remapped on import).
 */
export const backupCategoryPlacementSchema = z.object({
  categoryId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
});

export const backupTransactionSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  originalDescription: z.string().nullable().optional(),
  dueDate: z.string(),
  amount: z.string(),
  effectiveAmount: z.string().nullable().optional(),
  recurrence: z.string(),
  effectiveDate: z.string().nullable().optional(),
  type: z.string(),
  notes: z.string().nullable().optional(),
  status: z.string(),
  endDate: z.string().nullable().optional(),
  installmentCount: z.number().int().nullable().optional(),
  installmentNumber: z.number().int().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  creditCardId: z.string().uuid().nullable().optional(),
  source: z.string().optional(),
  externalId: z.string().uuid().nullable().optional(),
});

export const BACKUP_VERSION = 2;

export const backupSnapshotSchema = z.object({
  // Accepts v1 (custom categories only) and v2 (adds system-category customizations). The
  // v2-only arrays default to [] so a v1 file still imports cleanly.
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  accounts: z.array(backupAccountSchema),
  creditCards: z.array(backupCreditCardSchema),
  categories: z.array(backupCategorySchema),
  transactions: z.array(backupTransactionSchema),
  categoryOverrides: z.array(backupCategoryOverrideSchema).default([]),
  hiddenCategories: z.array(z.string().uuid()).default([]),
  categoryPlacements: z.array(backupCategoryPlacementSchema).default([]),
});
export type BackupSnapshot = z.infer<typeof backupSnapshotSchema>;

/**
 * How an import reconciles with existing data.
 * - `merge`: keep current data, append the snapshot (new ids).
 * - `replace`: wipe current data first, then load the snapshot. Irreversible.
 */
export const importModeSchema = z.enum(['merge', 'replace']);
export type ImportMode = z.infer<typeof importModeSchema>;

/** Row counts inserted by an import. */
export const importResultSchema = z.object({
  accounts: z.number().int().nonnegative(),
  creditCards: z.number().int().nonnegative(),
  categories: z.number().int().nonnegative(),
  transactions: z.number().int().nonnegative(),
});
export type ImportResult = z.infer<typeof importResultSchema>;
