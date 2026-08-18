import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Recurrence, SortOrder, TransactionSort, TransactionType } from '@finance/contracts';

/** UI-only filter state (server state stays in TanStack Query). */
export interface TransactionFilters {
  search?: string;
  amount?: string;
  recurrence?: Recurrence;
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
  creditCardId?: string;
}

export interface TransactionsUIState {
  filters: TransactionFilters;
  sort: TransactionSort;
  order: SortOrder;
  showOverdue: boolean;
}

const initialState: TransactionsUIState = {
  filters: {},
  sort: 'dueDate',
  order: 'asc',
  showOverdue: false,
};

const transactionsUiSlice = createSlice({
  name: 'transactionsUi',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<TransactionFilters>) {
      // Drop empty strings so they never reach the query.
      const merged = { ...state.filters, ...action.payload };
      state.filters = Object.fromEntries(
        Object.entries(merged).filter(([, v]) => v !== undefined && v !== ''),
      );
    },
    clearFilters(state) {
      state.filters = {};
    },
    toggleSort(state, action: PayloadAction<TransactionSort>) {
      if (state.sort === action.payload) {
        state.order = state.order === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = action.payload;
        state.order = 'asc';
      }
    },
    setShowOverdue(state, action: PayloadAction<boolean>) {
      state.showOverdue = action.payload;
    },
  },
});

export const { setFilters, clearFilters, toggleSort, setShowOverdue } =
  transactionsUiSlice.actions;
export const transactionsUiReducer = transactionsUiSlice.reducer;
