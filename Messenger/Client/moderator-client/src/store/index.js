// src/store/index.js
import { configureStore } from '@reduxjs/toolkit';
import serverReducer from './slices/serverSlice';
import userReducer from './slices/userSlice';
import channelReducer from './slices/channelSlice';
import messageReducer from './slices/messageSlice';

const store = configureStore({
  reducer: {
    server: serverReducer,
    user: userReducer,
    channel: channelReducer,
    message: messageReducer,
  },
});

export default store;
