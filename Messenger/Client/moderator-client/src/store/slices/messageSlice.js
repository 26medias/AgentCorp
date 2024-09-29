// src/store/slices/messageSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    messages: [],
};

const messageSlice = createSlice({
    name: 'message',
    initialState,
    reducers: {
        setMessages(state, action) {
            state.messages = action.payload.map((log) => ({
                ...log.message,
                timestamp: log.timestamp,
            }));
        },
    },
});

export const { setMessages } = messageSlice.actions;

export default messageSlice.reducer;
