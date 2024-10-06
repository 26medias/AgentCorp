// serverSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  serverName: 'jupiter-ruins',
};

const serverSlice = createSlice({
  name: 'server',
  initialState,
  reducers: {
    setServerName(state, action) {
      state.serverName = action.payload;
    },
  },
});

export const { setServerName } = serverSlice.actions;
export default serverSlice.reducer;
