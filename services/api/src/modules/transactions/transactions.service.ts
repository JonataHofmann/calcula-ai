import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository, type SelectQueryBuilder } from 'typeorm';
import type {
  CategorySuggestionResult,
  CommitInvoiceInput,
  CommitInvoiceResult,
  CreateTransactionInput,
  EffectuateInput,
  CreateProjectionEstimateInput,
  ForecastQuery,
  ForecastResponse,
  ForecastRow,
  GroupScope,
  ListTransactionsQuery,
  OverdueQuery,
  ProjectionEstimate,
  SortOrder,
  TransactionSort,
  TransactionType,
  UpdateProjectionEstimateInput,
  UpdateTransactionInput,
} from '@finance/contracts';
import { normalizeDescription } from './normalize-description';
import { invoiceDueDate, invoiceDueDateForPurchase, referenceMonthWindow } from './billing-cycle';
import { CategoryEntity } from '../categories/entities/category.entity';
import { AccountEntity } from '../accounts/entities/account.entity';
import { CreditCardEntity } from '../cards/entities/credit-card.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { ProjectionEstimateEntity } from './entities/projection-estimate.entity';
import { Transaction, type UpdateTransactionAttributes } from './transaction.model';
import { addMonthClamped, fromCents, nextOccurrence, splitInstallments, toCents } from './recurrence';
import {
  InvalidTransactionError,
  ProjectionEstimateNotFoundError,
  ReferenceNotFoundError,
  SyncedImportConflictError,
  TransactionNotFoundError,
  type FindTransactionsFilter,
  type ListedTransaction,
} from './transactions.types';
import type {
  ImportSyncedTransactionInput,
  PatchSyncedTransactionInput,
  SyncedImportResult,
} from './import-synced-transaction.schemas';

const SORT_COLUMN: Record<TransactionSort, string> = {
  dueDate: 't.due_date',
  amount: 't.amount',
  description: 't.description',
  status: 't.status',
  type: 't.type',
  recurrence: 't.recurrence',
};

/** Optional listing filters shared by the due-date and cash (effective-date) queries. */
function applyOptionalFilters(
  qb: SelectQueryBuilder<TransactionEntity>,
  filter: FindTransactionsFilter,
): void {
  if (filter.search) {
    qb.andWhere(
      '(t.description ILIKE :search OR t.notes ILIKE :search OR t.amount::text ILIKE :search)',
      { search: `%${filter.search}%` },
    );
  }
  if (filter.amount) {
    qb.andWhere('t.amount::text ILIKE :amount', { amount: `%${filter.amount}%` });
  }
  if (filter.recurrence) qb.andWhere('t.recurrence = :recurrence', { recurrence: filter.recurrence });
  if (filter.type) qb.andWhere('t.type = :type', { type: filter.type });
  // A parent selection expands to the category + its subcategories (categoryIds); a leaf stays exact.
  if (filter.categoryIds && filter.categoryIds.length > 0) {
    qb.andWhere('t.category_id IN (:...categoryIds)', { categoryIds: filter.categoryIds });
  } else if (filter.categoryId) {
    qb.andWhere('t.category_id = :categoryId', { categoryId: filter.categoryId });
  }
  if (filter.accountId) qb.andWhere('t.account_id = :accountId', { accountId: filter.accountId });
  if (filter.creditCardId)
    qb.andWhere('t.credit_card_id = :creditCardId', { creditCardId: filter.creditCardId });
}

/** The date a listed row belongs to this month by: cash date for logical rows, else the due date. */
function listedDate(l: ListedTransaction): number {
  const d = l.logical ? (l.transaction.effectiveDate ?? l.transaction.dueDate) : l.transaction.dueDate;
  return d.getTime();
}

/** Sorts the merged real + logical listing in JS (SQL can't order across the two queries). */
function sortListed(
  rows: ListedTransaction[],
  sort: TransactionSort,
  order: SortOrder,
): ListedTransaction[] {
  const dir = order === 'desc' ? -1 : 1;
  return rows.sort((a, b) => {
    const ta = a.transaction;
    const tb = b.transaction;
    let cmp: number;
    switch (sort) {
      case 'amount':
        cmp = Number(ta.amount) - Number(tb.amount);
        break;
      case 'description':
        cmp = ta.description.localeCompare(tb.description);
        break;
      case 'status':
        cmp = ta.status.localeCompare(tb.status);
        break;
      case 'type':
        cmp = ta.type.localeCompare(tb.type);
        break;
      case 'recurrence':
        cmp = ta.recurrence.localeCompare(tb.recurrence);
        break;
      case 'dueDate':
      default:
        cmp = listedDate(a) - listedDate(b);
        break;
    }
    if (cmp !== 0) return cmp * dir;
    return ta.id.localeCompare(tb.id) * dir;
  });
}

interface ReferenceInput {
  type: TransactionType;
  categoryId: string;
  accountId?: string | null;
  creditCardId?: string | null;
}

export interface EffectuateResult {
  transaction: Transaction;
  next: Transaction | null;
}

/**
 * All business logic for the transactions module (10 folded use-cases + reference
 * validation + persistence). The aggregate {@link Transaction} enforces value/origin/
 * recurrence invariants; persistence is accessed exclusively via the four injected
 * TypeORM repositories (FR-008, FR-009). Every query is scoped by `userId` so cross-user
 * rows are invisible (→ 404). The service returns aggregates; the controller converts to DTOs.
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(CreditCardEntity)
    private readonly creditCardRepo: Repository<CreditCardEntity>,
    @InjectRepository(ProjectionEstimateEntity)
    private readonly projectionRepo: Repository<ProjectionEstimateEntity>,
  ) {}

  // --- commands ---

  /** Create a single row, or a group (installment parcels / fixed occurrence) sharing a groupId. */
  async create(userId: string, input: CreateTransactionInput): Promise<Transaction[]> {
    this.logger.log(`Creating ${input.recurrence} transaction for user ${userId}`);
    await this.validateReferences(userId, {
      type: input.type,
      categoryId: input.categoryId,
      accountId: input.accountId ?? null,
      creditCardId: input.creditCardId ?? null,
    });

    // Card rows: the user gives the purchase date; the invoice due date is derived from the
    // card's closing/due cycle so the row lands in the right invoice (competência do vencimento).
    // Account rows: the given date IS the due date, and there is no purchase date.
    let dueDate: Date;
    let purchaseDate: Date | null;
    if (input.creditCardId) {
      const card = await this.creditCardRepo.findOne({
        where: { id: input.creditCardId, userId },
      });
      if (!card) throw new ReferenceNotFoundError('card', input.creditCardId);
      purchaseDate = new Date(input.purchaseDate ?? input.dueDate);
      dueDate = invoiceDueDateForPurchase(purchaseDate, card.closingDay, card.dueDay);
    } else {
      dueDate = new Date(input.dueDate);
      purchaseDate = null;
    }

    const common = {
      userId,
      description: input.description,
      type: input.type,
      categoryId: input.categoryId,
      accountId: input.accountId ?? null,
      creditCardId: input.creditCardId ?? null,
      notes: input.notes ?? null,
      purchaseDate,
    };

    if (input.recurrence === 'installment') {
      const groupId = randomUUID();
      const count = input.installmentCount;
      const amounts =
        input.totalAmount !== undefined
          ? splitInstallments(toCents(input.totalAmount), count)
          : Array.from({ length: count }, () => input.amount as string);
      const rows = amounts.map((amount, i) =>
        Transaction.create({
          ...common,
          id: randomUUID(),
          recurrence: 'installment',
          amount,
          dueDate: addMonthClamped(dueDate, i),
          installmentCount: count,
          installmentNumber: i + 1,
          groupId,
        }),
      );
      await this.persistMany(rows);
      this.logger.log(`Created installment group ${groupId} (${rows.length} rows) for user ${userId}`);
      return rows;
    }

    if (input.recurrence === 'fixed') {
      const transaction = Transaction.create({
        ...common,
        id: randomUUID(),
        recurrence: 'fixed',
        amount: input.amount,
        dueDate,
        endDate: input.endDate ? new Date(input.endDate) : null,
        groupId: randomUUID(),
      });
      await this.persistOne(transaction);
      this.logger.log(`Created fixed transaction ${transaction.id} for user ${userId}`);
      return [transaction];
    }

    const transaction = Transaction.create({
      ...common,
      id: randomUUID(),
      recurrence: 'single',
      amount: input.amount,
      dueDate,
    });
    // Optionally create it already effectuated; missing effectiveDate → the due date.
    if (input.paid) {
      transaction.effectuate({
        date: input.effectiveDate ? new Date(input.effectiveDate) : dueDate,
      });
    }
    await this.persistOne(transaction);
    this.logger.log(`Created transaction ${transaction.id} for user ${userId}`);
    return [transaction];
  }

  /** Applies editable fields to one occurrence or a group scope; paid rows keep effectuation (R3/R6). */
  async update(
    userId: string,
    id: string,
    input: UpdateTransactionInput,
    scope?: GroupScope,
  ): Promise<Transaction[]> {
    this.logger.log(`Updating transaction ${id} for user ${userId}`);
    const target = await this.findById(id, userId);
    if (!target) {
      this.logger.warn(`Transaction ${id} not found for user ${userId}`);
      throw new TransactionNotFoundError(id);
    }

    await this.validateReferences(userId, {
      type: input.type ?? target.type,
      categoryId: input.categoryId ?? target.categoryId,
      accountId: input.accountId !== undefined ? input.accountId : target.accountId,
      creditCardId: input.creditCardId !== undefined ? input.creditCardId : target.creditCardId,
    });

    const patch = toDomainPatch(input);
    const singleScope = !target.groupId || !scope || scope === 'one';

    // Card rows (single scope): recompute the invoice due date from the purchase date + card cycle
    // whenever the purchase date or the card itself changes. Grouped scopes (installments/fixed)
    // keep the current date-editing behavior — the spacing between parcels must be preserved.
    if (singleScope) {
      const nextCardId =
        input.creditCardId !== undefined ? input.creditCardId : target.creditCardId;
      if (nextCardId && (patch.purchaseDate !== undefined || input.creditCardId !== undefined)) {
        const purchase = patch.purchaseDate ?? target.purchaseDate;
        if (purchase) {
          const card = await this.creditCardRepo.findOne({ where: { id: nextCardId, userId } });
          if (!card) throw new ReferenceNotFoundError('card', nextCardId);
          patch.purchaseDate = purchase;
          patch.dueDate = invoiceDueDateForPurchase(purchase, card.closingDay, card.dueDay);
        }
      }
    }

    if (singleScope) {
      target.update(patch);
      await this.saveOne(target);
      this.logger.log(`Updated transaction ${id} for user ${userId}`);
      return [target];
    }

    const group = await this.findGroup(target.groupId, userId);
    const targets =
      scope === 'all'
        ? group
        : group.filter((t) => t.dueDate.getTime() >= target.dueDate.getTime());
    // Date fields are per-occurrence in a group (parcels/fixed): applying one absolute dueDate to
    // every row would collapse them onto the same (group_id, due_date) and violate
    // uq_transactions_group_due. Each parcel keeps its own dueDate/purchaseDate on a group edit.
    const groupPatch = { ...patch };
    delete groupPatch.dueDate;
    delete groupPatch.purchaseDate;
    for (const t of targets) t.update(groupPatch);
    await this.saveMany(targets);
    this.logger.log(`Updated ${targets.length} transaction(s) in group ${target.groupId} for user ${userId}`);
    return targets;
  }

  /** Deletes one occurrence, or a group scope (one/future/all) including paid rows (R6). */
  async delete(userId: string, id: string, scope?: GroupScope): Promise<void> {
    this.logger.log(`Deleting transaction ${id} (scope=${scope ?? 'one'}) for user ${userId}`);
    const target = await this.findById(id, userId);
    if (!target) {
      this.logger.warn(`Transaction ${id} not found for user ${userId}`);
      throw new TransactionNotFoundError(id);
    }

    if (!target.groupId || !scope || scope === 'one') {
      await this.deleteOne(id, userId);
      return;
    }

    if (scope === 'all') {
      await this.deleteGroup(target.groupId, userId);
      return;
    }

    // scope === 'future': this occurrence and every later one in the group.
    const group = await this.findGroup(target.groupId, userId);
    const targets = group.filter((t) => t.dueDate.getTime() >= target.dueDate.getTime());
    for (const t of targets) {
      await this.deleteOne(t.id, userId);
    }
  }

  /** pending -> paid; a fixed occurrence materializes the next pending row (FR-014/R10). */
  async effectuate(userId: string, id: string, input: EffectuateInput): Promise<EffectuateResult> {
    this.logger.log(`Effectuating transaction ${id} for user ${userId}`);
    const transaction = await this.findById(id, userId);
    if (!transaction) {
      this.logger.warn(`Transaction ${id} not found for user ${userId}`);
      throw new TransactionNotFoundError(id);
    }

    transaction.effectuate({
      date: input.date ? new Date(input.date) : undefined,
      amount: input.amount,
    });

    const next = await this.materializeNext(userId, transaction);
    await this.saveOne(transaction);
    // Insert the next occurrence ignoring conflicts: a concurrent list-window
    // materialization may have created the same (group_id, due_date) already.
    if (next) await this.persistManyIgnoreConflicts([next]);
    this.logger.log(`Effectuated transaction ${id} for user ${userId}${next ? ` (materialized ${next.id})` : ''}`);
    return { transaction, next };
  }

  /** paid -> pending. Inverse of effectuate(); does not un-materialize a next fixed occurrence. */
  async undoEffectuate(userId: string, id: string): Promise<Transaction> {
    this.logger.log(`Undoing effectuation of transaction ${id} for user ${userId}`);
    const transaction = await this.findById(id, userId);
    if (!transaction) {
      this.logger.warn(`Transaction ${id} not found for user ${userId}`);
      throw new TransactionNotFoundError(id);
    }
    transaction.undoEffectuate();
    await this.saveOne(transaction);
    this.logger.log(`Undid effectuation of transaction ${id} for user ${userId}`);
    return transaction;
  }

  // --- queries ---

  async get(userId: string, id: string): Promise<Transaction> {
    this.logger.log(`Fetching transaction ${id} for user ${userId}`);
    const transaction = await this.findById(id, userId);
    if (!transaction) {
      this.logger.warn(`Transaction ${id} not found for user ${userId}`);
      throw new TransactionNotFoundError(id);
    }
    return transaction;
  }

  async list(userId: string, query: ListTransactionsQuery): Promise<Transaction[]> {
    this.logger.log(`Listing transactions for user ${userId}`);
    const dueFrom = new Date(query.dueFrom);
    const dueTo = new Date(query.dueTo);
    // A fixed expense persists only one row; future months are materialized lazily when
    // the user navigates to them, so the monthly list shows the occurrence like any other
    // real (effectuable/editable) row. Forecast keeps its own pure projection (find()).
    const filter = await this.buildListFilter(userId, query);
    await this.ensureFixedOccurrences(userId, dueFrom, dueTo);
    return this.find(userId, filter);
  }

  /**
   * Cash-basis monthly listing (Option A). A paid transaction counts in the month it was
   * effectuated, not the month it was due: real rows due in the window are returned (a paid
   * one whose effectiveDate falls elsewhere stays visible but flagged `settledElsewhere`,
   * excluded from the balance) plus logical rows for paid transactions effectuated in the
   * window but due outside it (counted here — no double counting).
   */
  async listCashBasis(userId: string, query: ListTransactionsQuery): Promise<ListedTransaction[]> {
    this.logger.log(`Listing (cash basis) transactions for user ${userId}`);
    const filter = await this.buildListFilter(userId, query);
    await this.ensureFixedOccurrences(userId, filter.dueFrom, filter.dueTo);

    const real = await this.find(userId, filter);
    const cash = await this.findCashInWindow(userId, filter);

    const inWindow = (d: Date | null): boolean =>
      d != null &&
      d.getTime() >= filter.dueFrom.getTime() &&
      d.getTime() <= filter.dueTo.getTime();

    const listed: ListedTransaction[] = real.map((t) => ({
      transaction: t,
      logical: false,
      settledElsewhere: t.status === 'paid' && !inWindow(t.effectiveDate),
    }));
    for (const t of cash) {
      listed.push({ transaction: t, logical: true, settledElsewhere: false });
    }

    return sortListed(listed, filter.sort, filter.order);
  }

  private listFilter(query: ListTransactionsQuery): FindTransactionsFilter {
    return {
      dueFrom: new Date(query.dueFrom),
      dueTo: new Date(query.dueTo),
      search: query.search,
      amount: query.amount,
      recurrence: query.recurrence,
      type: query.type,
      categoryId: query.categoryId,
      accountId: query.accountId,
      creditCardId: query.creditCardId,
      sort: query.sort,
      order: query.order,
    };
  }

  /** {@link listFilter} plus the async category-subcategory expansion, shared by both list paths. */
  private async buildListFilter(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<FindTransactionsFilter> {
    const filter = this.listFilter(query);
    // Selecting a category lists its subcategories' transactions too (FR: filtro por categoria pai).
    if (query.categoryId) {
      filter.categoryIds = await this.resolveCategoryFilterIds(userId, query.categoryId);
    }
    return filter;
  }

  /**
   * The selected category plus its subcategories, so filtering by a parent lists its children's
   * transactions too. Children are found by the stored `parentId` across the user's own categories
   * and the shared system defaults (categories nest at most one level deep). Per-user drag-reparents
   * of system defaults (the placements table) are not reflected here — an accepted edge for now.
   */
  private async resolveCategoryFilterIds(
    userId: string,
    categoryId: string,
  ): Promise<string[]> {
    const children = await this.categoryRepo.find({
      where: [
        { parentId: categoryId, ownerId: userId },
        { parentId: categoryId, ownerId: IsNull() },
      ],
      select: { id: true },
    });
    return [categoryId, ...children.map((c) => c.id)];
  }

  /** Pending occurrences due before the current month start (user timezone -> `before`). */
  async listOverdue(userId: string, query: OverdueQuery): Promise<Transaction[]> {
    this.logger.log(`Listing overdue transactions for user ${userId}`);
    return this.findOverdue(userId, new Date(query.before));
  }

  async getForecast(userId: string, query: ForecastQuery): Promise<ForecastResponse> {
    this.logger.log(`Building forecast for user ${userId}`);
    const months = buildMonthsList(query.from, query.months);
    const dueFrom = new Date(0);
    const dueTo = addMonthClamped(parseMonth(months[months.length - 1] as string), 1);

    const all = await this.find(userId, { dueFrom, dueTo, sort: 'dueDate', order: 'asc' });
    const relevant = all.filter((t) => t.type === 'expense' && t.recurrence !== 'single');

    const groups = new Map<string, Transaction[]>();
    for (const t of relevant) {
      const key = t.groupId as string;
      const bucket = groups.get(key);
      if (bucket) bucket.push(t);
      else groups.set(key, [t]);
    }

    const [cardMap, accountMap] = await Promise.all([
      this.creditCardRepo
        .find({ where: { userId } })
        .then((cs) => new Map(cs.map((c) => [c.id, c.name]))),
      this.accountRepo
        .find({ where: { userId } })
        .then((as) => new Map(as.map((a) => [a.id, a.name]))),
    ]);

    const rows: ForecastRow[] = [];
    for (const [key, group] of groups) {
      const first = group[0] as Transaction;
      const origin = resolveOrigin(first, cardMap, accountMap);
      if (first.recurrence === 'installment') {
        rows.push({
          key,
          description: first.description,
          recurrence: 'installment',
          type: 'expense',
          installmentCount: first.installmentCount,
          ...origin,
          cells: projectInstallmentCells(group, months),
        });
      } else {
        rows.push({
          key,
          description: first.description,
          recurrence: 'fixed',
          type: 'expense',
          installmentCount: null,
          ...origin,
          cells: projectFixedCells(group, months),
        });
      }
    }

    // Projection-only estimates: one row each, same amount in EVERY month (recurring average).
    const estimates = await this.projectionRepo.find({ where: { userId } });
    for (const est of estimates) {
      rows.push({
        key: `estimate-${est.id}`,
        description: est.description,
        recurrence: 'estimate',
        type: est.type,
        installmentCount: null,
        originKind: null,
        originId: null,
        originName: null,
        cells: months.map((month) => ({ month, amount: est.amount })),
      });
    }

    // Card commitments first, then fixed (non-card), then installments, then estimates last.
    rows.sort((a, b) => forecastRank(a) - forecastRank(b));

    const totals = months.map((month, i) => {
      const cents = rows.reduce((sum, row) => {
        const cell = row.cells[i];
        if (!cell?.amount) return sum;
        // Expenses add to the projected Total; incomes (estimates) subtract from it.
        return row.type === 'income' ? sum - toCents(cell.amount) : sum + toCents(cell.amount);
      }, 0);
      return { month, amount: fromCents(cents) };
    });

    return { months, rows, totals };
  }

  // --- projection estimates (projection-only rows; never real transactions) ---

  async listProjectionEstimates(userId: string): Promise<ProjectionEstimate[]> {
    this.logger.log(`Listing projection estimates for user ${userId}`);
    const rows = await this.projectionRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toProjectionEstimateDto);
  }

  async createProjectionEstimate(
    userId: string,
    input: CreateProjectionEstimateInput,
  ): Promise<ProjectionEstimate> {
    this.logger.log(`Creating projection estimate for user ${userId}`);
    const entity = this.projectionRepo.create({
      id: randomUUID(),
      userId,
      description: input.description,
      amount: input.amount,
      type: input.type,
    });
    await this.projectionRepo.insert(entity);
    return toProjectionEstimateDto(entity);
  }

  async updateProjectionEstimate(
    userId: string,
    id: string,
    input: UpdateProjectionEstimateInput,
  ): Promise<ProjectionEstimate> {
    this.logger.log(`Updating projection estimate ${id} for user ${userId}`);
    const existing = await this.projectionRepo.findOne({ where: { id, userId } });
    if (!existing) throw new ProjectionEstimateNotFoundError(id);
    if (input.description !== undefined) existing.description = input.description;
    if (input.amount !== undefined) existing.amount = input.amount;
    if (input.type !== undefined) existing.type = input.type;
    await this.projectionRepo.save(existing);
    return toProjectionEstimateDto(existing);
  }

  async deleteProjectionEstimate(userId: string, id: string): Promise<void> {
    this.logger.log(`Deleting projection estimate ${id} for user ${userId}`);
    const { affected } = await this.projectionRepo.delete({ id, userId });
    if (!affected) throw new ProjectionEstimateNotFoundError(id);
  }

  /**
   * For each requested description, the category of the user's most recent expense with the
   * same normalized description (trim/lowercase/collapsed spaces), or null when none exists.
   * Scoped to the user; used by invoice import to pre-fill categories (FR-011). One row per
   * requested description, preserving the original text and order.
   */
  async suggestCategories(
    userId: string,
    descriptions: string[],
  ): Promise<CategorySuggestionResult> {
    this.logger.log(`Suggesting categories for ${descriptions.length} description(s), user ${userId}`);
    const targets = new Set(descriptions.map(normalizeDescription));

    const rows = await this.txRepo.find({
      where: { userId, type: 'expense' },
      order: { dueDate: 'DESC', createdAt: 'DESC' },
    });

    // rows are newest-first: the first match for a normalized description wins.
    // Match on the raw imported text when present so a renamed row still matches
    // the merchant string sent by the importer.
    const byNormalized = new Map<string, string>();
    for (const row of rows) {
      const norm = normalizeDescription(row.originalDescription ?? row.description);
      if (targets.has(norm) && !byNormalized.has(norm)) {
        byNormalized.set(norm, row.categoryId);
      }
    }

    return descriptions.map((description) => ({
      description,
      categoryId: byNormalized.get(normalizeDescription(description)) ?? null,
    }));
  }

  /**
   * Commits reviewed invoice lines as `pending` transactions on the card (FR-012..FR-019).
   * Each line's type is derived from its amount sign — purchases (positive) become despesas,
   * refunds/credits (negative) become receitas — and its category must match that type.
   * `dueDate` = card due day in the reference month (billing-cycle). Lines with an
   * installment marker become an `installment` group; others `single`. `replace` deletes
   * the card+month scope first; `merge` inserts only lines whose (day, amount, normalized
   * description) is absent from the scope. Delete + insert run in one DB transaction.
   * The card must belong to the user (else 404); `userId` comes from the JWT, never the body.
   */
  async commitInvoice(
    userId: string,
    input: CommitInvoiceInput,
  ): Promise<CommitInvoiceResult> {
    this.logger.log(
      `Committing invoice import (${input.mode}) for user ${userId}, card ${input.creditCardId}, month ${input.referenceMonth}`,
    );
    const card = await this.creditCardRepo.findOne({
      where: { id: input.creditCardId, userId },
    });
    if (!card) throw new ReferenceNotFoundError('card', input.creditCardId);

    const dueDate = invoiceDueDate(input.referenceMonth, card.dueDay);
    const { start, endExclusive } = referenceMonthWindow(input.referenceMonth);

    const kept = input.lines.filter((line) => !line.discarded);
    // Validate each kept line's category (type coherence + ownership) before writing.
    // The line's type is derived from the sign of its amount: a credit-card invoice lists
    // purchases as positive (despesa) and refunds/credits/payments — estorno, "pagamento",
    // crédito — as negative (receita). The chosen category must match that type.
    for (const line of kept) {
      await this.validateReferences(userId, {
        type: invoiceLineType(line.amount),
        categoryId: line.categoryId,
        accountId: null,
        creditCardId: input.creditCardId,
      });
    }

    const scopeRows = (
      await this.txRepo.find({
        where: { userId, creditCardId: input.creditCardId },
      })
    ).filter(
      (row) =>
        row.dueDate.getTime() >= start.getTime() &&
        row.dueDate.getTime() < endExclusive.getTime(),
    );

    const toInsert: Transaction[] = [];
    let added = 0;
    let skipped = 0;

    const seen = new Set(
      input.mode === 'merge'
        ? scopeRows.map((r) =>
            dedupKey(r.dueDate, r.amount, r.originalDescription ?? r.description),
          )
        : [],
    );

    for (const line of kept) {
      // Refunds/credits arrive negative — store the positive magnitude (the type carries the
      // direction) and dedup on that same value so a re-import matches the stored row.
      const amount = fromCents(Math.abs(toCents(line.amount)));
      if (input.mode === 'merge') {
        const key = dedupKey(
          dueDate,
          amount,
          line.originalDescription ?? line.description,
        );
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
      }
      toInsert.push(
        ...this.buildInvoiceRows(
          userId,
          input.creditCardId,
          line,
          dueDate,
          amount,
          invoiceLineType(line.amount),
        ),
      );
      added++;
    }

    const removed = input.mode === 'replace' ? scopeRows.length : 0;

    await this.txRepo.manager.transaction(async (manager) => {
      if (input.mode === 'replace') {
        for (const row of scopeRows) {
          await manager.delete(TransactionEntity, { id: row.id, userId });
        }
      }
      if (toInsert.length > 0) {
        await manager.insert(TransactionEntity, toInsert.map(toEntity));
      }
    });

    this.logger.log(
      `Invoice import committed for user ${userId}: added=${added} skipped=${skipped} removed=${removed}`,
    );
    return { added, skipped, removed };
  }

  /** One reviewed line -> a `single` row or a full `installment` group (reuses create's rules). */
  private buildInvoiceRows(
    userId: string,
    creditCardId: string,
    line: CommitInvoiceInput['lines'][number],
    dueDate: Date,
    amount: string,
    type: TransactionType,
  ): Transaction[] {
    // Persist the raw text only when the user actually renamed the line, so the
    // merchant string stays available for future category matching.
    const originalDescription =
      line.originalDescription && line.originalDescription !== line.description
        ? line.originalDescription
        : null;
    const common = {
      userId,
      description: line.description,
      originalDescription,
      type,
      categoryId: line.categoryId,
      accountId: null,
      creditCardId,
      notes: null,
      source: 'imported' as const,
    };

    // Despesa fixa marcada no review: uma única transação recorrente (sem fim), independente
    // de parcelas. Precede o ramo de parcelas — uma fixa não é parcelada.
    if (line.fixed) {
      return [
        Transaction.create({
          ...common,
          id: randomUUID(),
          recurrence: 'fixed',
          amount,
          dueDate,
          endDate: null,
          groupId: randomUUID(),
        }),
      ];
    }

    if (line.installmentNumber && line.installmentCount) {
      const groupId = randomUUID();
      const count = line.installmentCount;
      // A fatura mostra a PARCELA ATUAL (installmentNumber); as anteriores já foram cobradas.
      // Importa só a atual + as subsequentes (current..count). Ex.: "3/10" -> 8 linhas (3..10);
      // "12/12" -> só a 12ª. O mês de referência é o vencimento da parcela atual.
      const current = Math.min(line.installmentNumber, count);
      const remaining = count - current + 1;
      return Array.from({ length: remaining }, (_, i) =>
        Transaction.create({
          ...common,
          id: randomUUID(),
          recurrence: 'installment',
          amount,
          dueDate: addMonthClamped(dueDate, i),
          installmentCount: count,
          installmentNumber: current + i,
          groupId,
        }),
      );
    }

    return [
      Transaction.create({
        ...common,
        id: randomUUID(),
        recurrence: 'single',
        amount,
        dueDate,
      }),
    ];
  }

  // --- synced import (service-to-service, banking-ms only) ---

  /**
   * Idempotent by `externalId`: a replay with the same body returns the existing result
   * untouched; a replay with a different body throws `SyncedImportConflictError` (409).
   * `pluggyStatus` is excluded from the comparison (not persisted on `Transaction`).
   */
  async importSyncedCreate(input: ImportSyncedTransactionInput): Promise<SyncedImportResult> {
    this.logger.log(`Importing synced transaction ${input.externalId} for user ${input.userId}`);
    const existing = await this.findByExternalId(input.externalId, input.userId);
    if (existing) {
      if (!matchesInput(existing, input)) {
        this.logger.warn(`Idempotency conflict for externalId ${input.externalId}`);
        throw new SyncedImportConflictError(input.externalId);
      }
      return toResult(existing, input.pluggyStatus);
    }

    const categoryId = input.categoryId ?? (await this.findDefaultCategoryId(input.type));
    if (!categoryId) {
      this.logger.warn(`No default category for type ${input.type}`);
      throw new ReferenceNotFoundError('category', 'default');
    }

    await this.validateReferences(input.userId, {
      type: input.type,
      categoryId,
      accountId: input.accountId,
      creditCardId: input.creditCardId,
    });

    const transaction = Transaction.create({
      id: randomUUID(),
      userId: input.userId,
      description: input.description,
      dueDate: new Date(input.dueDate),
      amount: input.amount,
      recurrence: 'single',
      type: input.type,
      categoryId,
      accountId: input.accountId,
      creditCardId: input.creditCardId,
      source: 'synced',
      externalId: input.externalId,
      installmentNumber: input.installmentNumber ?? null,
      installmentCount: input.installmentCount ?? null,
    });
    await this.persistOne(transaction);
    this.logger.log(`Imported synced transaction ${transaction.id} for user ${input.userId}`);
    return toResult(transaction, input.pluggyStatus);
  }

  async importSyncedPatch(
    userId: string,
    externalId: string,
    patch: PatchSyncedTransactionInput,
  ): Promise<SyncedImportResult> {
    this.logger.log(`Patching synced transaction ${externalId} for user ${userId}`);
    const transaction = await this.findByExternalId(externalId, userId);
    if (!transaction) {
      this.logger.warn(`Synced transaction ${externalId} not found for user ${userId}`);
      throw new TransactionNotFoundError(externalId);
    }

    transaction.update({
      description: patch.description,
      amount: patch.amount,
      dueDate: patch.dueDate ? new Date(patch.dueDate) : undefined,
      installmentNumber: patch.installmentNumber,
      installmentCount: patch.installmentCount,
    });
    await this.saveOne(transaction);
    return toResult(transaction, patch.pluggyStatus ?? 'posted');
  }

  async importSyncedDelete(userId: string, externalId: string): Promise<void> {
    this.logger.log(`Deleting synced transaction ${externalId} for user ${userId}`);
    const transaction = await this.findByExternalId(externalId, userId);
    if (!transaction) {
      this.logger.warn(`Synced transaction ${externalId} not found for user ${userId}`);
      throw new TransactionNotFoundError(externalId);
    }
    await this.deleteOne(transaction.id, userId);
  }

  // --- reference validation (folded from validate-references + lookups) ---

  /** Category/account/card must exist, belong to the user (else 404), and category type must match (R9/FR-022). */
  private async validateReferences(userId: string, input: ReferenceInput): Promise<void> {
    const categoryType = await this.findCategoryType(input.categoryId, userId);
    if (categoryType === null) throw new ReferenceNotFoundError('category', input.categoryId);
    if (categoryType !== input.type) {
      throw new InvalidTransactionError('Category type does not match transaction type');
    }

    if (input.accountId) {
      const ok = await this.accountRepo.exists({ where: { id: input.accountId, userId } });
      if (!ok) throw new ReferenceNotFoundError('account', input.accountId);
    }
    if (input.creditCardId) {
      const ok = await this.creditCardRepo.exists({ where: { id: input.creditCardId, userId } });
      if (!ok) throw new ReferenceNotFoundError('card', input.creditCardId);
    }
  }

  /** Category type if it exists and is owned by the user or a shared system default, else null. */
  private async findCategoryType(id: string, userId: string): Promise<TransactionType | null> {
    const own = await this.categoryRepo.findOne({ where: { id, ownerId: userId } });
    const row = own ?? (await this.categoryRepo.findOne({ where: { id, ownerId: IsNull() } }));
    return row ? (row.type as TransactionType) : null;
  }

  /** "Outros" system catch-all category id for a type (synced imports with no category), else null. */
  private async findDefaultCategoryId(type: TransactionType): Promise<string | null> {
    const row = await this.categoryRepo.findOne({
      where: { ownerId: IsNull(), type, name: 'Outros', isSystem: true },
    });
    return row?.id ?? null;
  }

  // --- fixed-recurrence materialization ---

  /**
   * Persists the fixed occurrences that fall inside [dueFrom, dueTo] but don't exist yet, so a
   * fixed expense shows up in future months as soon as the user opens them. Each group is chained
   * forward from its latest row (same date math as the forecast projection). Idempotent: months
   * that already have a row are skipped; bounded by MAX_PROJECTED_MONTHS to cap growth. Rows are
   * created `pending` and are fully actionable (effectuate/edit/delete).
   */
  private async ensureFixedOccurrences(userId: string, dueFrom: Date, dueTo: Date): Promise<void> {
    if (dueTo.getTime() < dueFrom.getTime()) return;
    const rows = await this.txRepo.find({ where: { userId, recurrence: 'fixed' } });
    if (rows.length === 0) return;

    const groups = new Map<string, TransactionEntity[]>();
    for (const row of rows) {
      const key = row.groupId ?? row.id;
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }

    const MAX_PROJECTED_MONTHS = 36;
    const toCreate: Transaction[] = [];

    for (const group of groups.values()) {
      const anchor = group.reduce((a, b) => (b.dueDate.getTime() > a.dueDate.getTime() ? b : a));
      const existingMonths = new Set(group.map((r) => formatMonth(r.dueDate)));

      let cursor: Date | null = anchor.dueDate;
      for (let step = 0; step < MAX_PROJECTED_MONTHS; step += 1) {
        cursor = nextOccurrence(cursor, anchor.endDate);
        if (!cursor) break; // past endDate
        if (cursor.getTime() > dueTo.getTime()) break; // beyond the requested window
        if (cursor.getTime() < dueFrom.getTime()) continue; // gap month before the window
        const month = formatMonth(cursor);
        if (existingMonths.has(month)) continue;
        existingMonths.add(month);
        toCreate.push(this.buildFixedOccurrence(userId, anchor, cursor));
      }
    }

    if (toCreate.length > 0) await this.persistManyIgnoreConflicts(toCreate);
  }

  /** A new pending fixed occurrence for `dueDate`, copying the group's latest row (reflects edits). */
  private buildFixedOccurrence(
    userId: string,
    anchor: TransactionEntity,
    dueDate: Date,
  ): Transaction {
    return Transaction.create({
      id: randomUUID(),
      userId,
      description: anchor.description,
      dueDate,
      amount: anchor.amount,
      recurrence: 'fixed',
      type: anchor.type as TransactionType,
      categoryId: anchor.categoryId,
      accountId: anchor.accountId,
      creditCardId: anchor.creditCardId,
      notes: anchor.notes,
      endDate: anchor.endDate,
      groupId: anchor.groupId,
    });
  }

  private async materializeNext(userId: string, current: Transaction): Promise<Transaction | null> {
    if (current.recurrence !== 'fixed' || !current.groupId) return null;
    const nextDue = nextOccurrence(current.dueDate, current.endDate);
    if (!nextDue) return null;

    const group = await this.findGroup(current.groupId, userId);
    const exists = group.some((t) => t.dueDate.getTime() === nextDue.getTime());
    if (exists) return null;

    return Transaction.create({
      id: randomUUID(),
      userId,
      description: current.description,
      dueDate: nextDue,
      amount: current.amount,
      recurrence: 'fixed',
      type: current.type,
      categoryId: current.categoryId,
      accountId: current.accountId,
      creditCardId: current.creditCardId,
      notes: current.notes,
      endDate: current.endDate,
      groupId: current.groupId,
    });
  }

  // --- persistence (folded from the removed custom repository; every op scoped by userId) ---

  private async persistOne(transaction: Transaction): Promise<void> {
    await this.txRepo.insert(toEntity(transaction));
  }

  private async persistMany(transactions: Transaction[]): Promise<void> {
    if (transactions.length === 0) return;
    await this.txRepo.manager.transaction(async (manager) => {
      await manager.insert(TransactionEntity, transactions.map(toEntity));
    });
  }

  /**
   * Insert ignoring `(group_id, due_date)` conflicts. Fixed-occurrence materialization runs
   * from several overlapping list windows in parallel (dashboard + transactions views), so two
   * concurrent calls can each read a month as missing and both insert it. The unique index
   * `uq_transactions_group_due` plus ON CONFLICT DO NOTHING makes the second insert a no-op
   * instead of a duplicate row.
   */
  private async persistManyIgnoreConflicts(transactions: Transaction[]): Promise<void> {
    if (transactions.length === 0) return;
    await this.txRepo
      .createQueryBuilder()
      .insert()
      .into(TransactionEntity)
      .values(transactions.map(toEntity))
      .orIgnore()
      .execute();
  }

  private async saveOne(transaction: Transaction): Promise<void> {
    await this.txRepo.save(toEntity(transaction));
  }

  private async saveMany(transactions: Transaction[]): Promise<void> {
    if (transactions.length === 0) return;
    await this.txRepo.manager.transaction(async (manager) => {
      await manager.save(transactions.map(toEntity));
    });
  }

  private async findById(id: string, userId: string): Promise<Transaction | null> {
    const row = await this.txRepo.findOne({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }

  private async findByExternalId(externalId: string, userId: string): Promise<Transaction | null> {
    const row = await this.txRepo.findOne({ where: { externalId, userId } });
    return row ? toDomain(row) : null;
  }

  private async findGroup(groupId: string, userId: string): Promise<Transaction[]> {
    const rows = await this.txRepo.find({ where: { groupId, userId }, order: { dueDate: 'ASC' } });
    return rows.map(toDomain);
  }

  private async findOverdue(userId: string, before: Date): Promise<Transaction[]> {
    const rows = await this.txRepo.find({
      where: { userId, status: 'pending', dueDate: LessThan(before) },
      order: { dueDate: 'ASC', id: 'ASC' },
    });
    return rows.map(toDomain);
  }

  private async find(userId: string, filter: FindTransactionsFilter): Promise<Transaction[]> {
    const qb = this.txRepo
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.due_date >= :dueFrom', { dueFrom: filter.dueFrom })
      .andWhere('t.due_date <= :dueTo', { dueTo: filter.dueTo });

    applyOptionalFilters(qb, filter);

    qb.orderBy(SORT_COLUMN[filter.sort], filter.order === 'desc' ? 'DESC' : 'ASC');
    qb.addOrderBy('t.id', 'ASC');

    const rows = await qb.getMany();
    return rows.map(toDomain);
  }

  /**
   * Paid transactions effectuated inside the window but due outside it — the source
   * of cash-basis logical rows (they move this month's balance even though they were
   * due in another month). Same optional filters as `find` so listing filters apply.
   */
  private async findCashInWindow(
    userId: string,
    filter: FindTransactionsFilter,
  ): Promise<Transaction[]> {
    const qb = this.txRepo
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.status = :paid', { paid: 'paid' })
      .andWhere('t.effective_date IS NOT NULL')
      .andWhere('t.effective_date >= :dueFrom', { dueFrom: filter.dueFrom })
      .andWhere('t.effective_date <= :dueTo', { dueTo: filter.dueTo })
      .andWhere('(t.due_date < :dueFrom OR t.due_date > :dueTo)', {
        dueFrom: filter.dueFrom,
        dueTo: filter.dueTo,
      });

    applyOptionalFilters(qb, filter);

    const rows = await qb.getMany();
    return rows.map(toDomain);
  }

  private async deleteOne(id: string, userId: string): Promise<void> {
    await this.txRepo.delete({ id, userId });
  }

  private async deleteGroup(groupId: string, userId: string): Promise<void> {
    await this.txRepo.manager.transaction(async (manager) => {
      await manager.delete(TransactionEntity, { groupId, userId });
    });
  }
}

// --- aggregate <-> entity mapping ---

function toEntity(transaction: Transaction): TransactionEntity {
  const props = transaction.toProps();
  const entity = new TransactionEntity();
  entity.id = props.id;
  entity.userId = props.userId;
  entity.description = props.description;
  entity.originalDescription = props.originalDescription;
  entity.dueDate = props.dueDate;
  entity.purchaseDate = props.purchaseDate;
  entity.amount = props.amount;
  entity.effectiveAmount = props.effectiveAmount;
  entity.recurrence = props.recurrence;
  entity.effectiveDate = props.effectiveDate;
  entity.type = props.type;
  entity.notes = props.notes;
  entity.status = props.status;
  entity.endDate = props.endDate;
  entity.installmentCount = props.installmentCount;
  entity.installmentNumber = props.installmentNumber;
  entity.groupId = props.groupId;
  entity.categoryId = props.categoryId;
  entity.accountId = props.accountId;
  entity.creditCardId = props.creditCardId;
  entity.source = props.source;
  entity.externalId = props.externalId;
  entity.createdAt = props.createdAt;
  entity.updatedAt = props.updatedAt;
  return entity;
}

/**
 * Merge dedup key (FR-019): a line duplicates an existing scope row when the due day,
 * amount and normalized description all match. The day component uses the UTC calendar day
 * of `dueDate` (the invoice due date), not the purchase date, so re-imports of the same
 * invoice line still collapse to one row.
 */
function dedupKey(dueDate: Date, amount: string, description: string): string {
  const day = dueDate.toISOString().slice(0, 10);
  return `${day}|${amount}|${normalizeDescription(description)}`;
}

/**
 * Type of an imported invoice line from the sign of its amount: negative means a
 * refund/credit/payment (estorno, crédito, "pagamento") the card gave back — a receita;
 * anything else is a purchase — a despesa.
 */
function invoiceLineType(amount: string): TransactionType {
  return toCents(amount) < 0 ? 'income' : 'expense';
}

function toDomain(row: TransactionEntity): Transaction {
  return Transaction.restore({
    id: row.id,
    userId: row.userId,
    description: row.description,
    originalDescription: row.originalDescription,
    dueDate: row.dueDate,
    purchaseDate: row.purchaseDate,
    amount: row.amount,
    effectiveAmount: row.effectiveAmount,
    recurrence: row.recurrence as Transaction['recurrence'],
    effectiveDate: row.effectiveDate,
    type: row.type as Transaction['type'],
    notes: row.notes,
    status: row.status as Transaction['status'],
    endDate: row.endDate,
    installmentCount: row.installmentCount,
    installmentNumber: row.installmentNumber,
    groupId: row.groupId,
    categoryId: row.categoryId,
    accountId: row.accountId,
    creditCardId: row.creditCardId,
    source: row.source as Transaction['source'],
    externalId: row.externalId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

// --- update-input -> aggregate patch ---

function toDomainPatch(input: UpdateTransactionInput): Partial<UpdateTransactionAttributes> {
  const patch: Partial<UpdateTransactionAttributes> = {};
  if (input.description !== undefined) patch.description = input.description;
  if (input.dueDate !== undefined) patch.dueDate = new Date(input.dueDate);
  if (input.purchaseDate !== undefined) patch.purchaseDate = new Date(input.purchaseDate);
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.type !== undefined) patch.type = input.type;
  if (input.notes !== undefined) patch.notes = input.notes ?? null;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
  if (input.accountId !== undefined) patch.accountId = input.accountId;
  if (input.creditCardId !== undefined) patch.creditCardId = input.creditCardId;
  if (input.endDate !== undefined) patch.endDate = input.endDate ? new Date(input.endDate) : null;
  return patch;
}

// --- synced-import idempotency helpers ---

/** Excludes `pluggyStatus` — not persisted on `Transaction`, has its own patch path. */
function matchesInput(transaction: Transaction, input: ImportSyncedTransactionInput): boolean {
  if (
    transaction.description !== input.description ||
    transaction.amount !== input.amount ||
    transaction.dueDate.getTime() !== new Date(input.dueDate).getTime() ||
    transaction.type !== input.type ||
    transaction.accountId !== input.accountId ||
    transaction.creditCardId !== input.creditCardId ||
    (transaction.installmentNumber ?? null) !== (input.installmentNumber ?? null) ||
    (transaction.installmentCount ?? null) !== (input.installmentCount ?? null)
  ) {
    return false;
  }
  if (input.categoryId !== undefined && transaction.categoryId !== input.categoryId) return false;
  return true;
}

function toResult(
  transaction: Transaction,
  pluggyStatus: SyncedImportResult['pluggyStatus'],
): SyncedImportResult {
  return {
    id: transaction.id,
    source: 'synced',
    externalId: transaction.externalId ?? '',
    pluggyStatus,
  };
}

// --- forecast projection (folded from get-forecast) ---

function parseMonth(month: string): Date {
  const [yearStr, monthStr] = month.split('-');
  return new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, 1));
}

function formatMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isSameMonth(a: Date, b: Date): boolean {
  return startOfMonth(a).getTime() === startOfMonth(b).getTime();
}

function buildMonthsList(from: string, count: number): string[] {
  const start = parseMonth(from);
  return Array.from({ length: count }, (_, i) => formatMonth(addMonthClamped(start, i)));
}

/** Origin (card/account) of a forecast group, resolved to a display name via the id→name maps. */
function resolveOrigin(
  tx: Transaction,
  cardMap: Map<string, string>,
  accountMap: Map<string, string>,
): Pick<ForecastRow, 'originKind' | 'originId' | 'originName'> {
  if (tx.creditCardId) {
    return {
      originKind: 'card',
      originId: tx.creditCardId,
      originName: cardMap.get(tx.creditCardId) ?? null,
    };
  }
  if (tx.accountId) {
    return {
      originKind: 'account',
      originId: tx.accountId,
      originName: accountMap.get(tx.accountId) ?? null,
    };
  }
  return { originKind: null, originId: null, originName: null };
}

/** Sort rank: card commitments first, then fixed (non-card), installments, then estimates last. */
function forecastRank(row: ForecastRow): number {
  if (row.recurrence === 'estimate') return 3;
  if (row.originKind === 'card') return 0;
  if (row.recurrence === 'fixed') return 1;
  return 2;
}

/** Maps a projection estimate row to its DTO (drops userId/timestamps — regra 9). */
function toProjectionEstimateDto(e: ProjectionEstimateEntity): ProjectionEstimate {
  return { id: e.id, description: e.description, amount: e.amount, type: e.type };
}

function projectFixedCells(
  group: Transaction[],
  months: string[],
): Array<{ month: string; amount: string | null }> {
  const byMonth = new Map<string, Transaction>();
  for (const row of group) byMonth.set(formatMonth(row.dueDate), row);
  // Anchor on the FIRST occurrence and walk forward. A fixed expense whose past months were
  // effectuated has several rows in the group (paid history + the next pending one, all sharing
  // the groupId); anchoring on the LAST row made every month before it project as null, so the
  // fixed showed up only in its latest (often the projection's last) month. group is dueDate-asc.
  const anchor = group[0] as Transaction;

  let cursor = anchor.dueDate;
  let amount = anchor.amount;
  let terminated = false;

  return months.map((month) => {
    const monthDate = parseMonth(month);
    if (monthDate.getTime() < startOfMonth(cursor).getTime()) {
      return { month, amount: null };
    }
    if (terminated) return { month, amount: null };

    while (!isSameMonth(cursor, monthDate)) {
      const next = nextOccurrence(cursor, anchor.endDate);
      if (next === null) {
        terminated = true;
        break;
      }
      cursor = next;
      const actual = byMonth.get(formatMonth(cursor));
      if (actual) amount = actual.amount;
    }
    if (terminated) return { month, amount: null };

    const actual = byMonth.get(formatMonth(cursor));
    if (actual) amount = actual.amount;
    return { month, amount };
  });
}

function projectInstallmentCells(
  group: Transaction[],
  months: string[],
): Array<{ month: string; amount: string | null }> {
  const byMonth = new Map<string, Transaction>();
  for (const row of group) byMonth.set(formatMonth(row.dueDate), row);
  return months.map((month) => {
    const row = byMonth.get(month);
    return { month, amount: row ? row.amount : null };
  });
}
