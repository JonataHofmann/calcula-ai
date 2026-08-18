import { configureStore } from '@reduxjs/toolkit';
import { transactionsUiReducer } from '../features/transactions/transactions-ui.slice';
import { uiReducer } from './ui-slice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    transactionsUi: transactionsUiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
