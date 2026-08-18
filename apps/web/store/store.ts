import { configureStore } from '@reduxjs/toolkit';
import { transactionsUiReducer } from '../features/transactions/transactions-ui.slice';
import { periodReducer } from './period-slice';
import { uiReducer } from './ui-slice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    period: periodReducer,
    transactionsUi: transactionsUiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
