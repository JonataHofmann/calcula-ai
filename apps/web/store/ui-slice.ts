import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Theme = 'light' | 'dark' | 'system';

export interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarMobileOpen: boolean;
}

const initialState: UIState = {
  theme: 'system',
  sidebarOpen: true,
  sidebarMobileOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    toggleSidebarMobile(state) {
      state.sidebarMobileOpen = !state.sidebarMobileOpen;
    },
    closeSidebarMobile(state) {
      state.sidebarMobileOpen = false;
    },
  },
});

export const { setTheme, toggleSidebar, toggleSidebarMobile, closeSidebarMobile } =
  uiSlice.actions;
export const uiReducer = uiSlice.reducer;
