// src/store/slices/channelSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    channels: [],
    selectedChannel: null,
    selectedDM: null,
};

const channelSlice = createSlice({
    name: 'channel',
    initialState,
    reducers: {
        selectChannel(state, action) {
            state.selectedChannel = action.payload;
            state.selectedDM = null;
        },
        selectDM(state, action) {
            state.selectedDM = action.payload;
            state.selectedChannel = null;
        },
        setChannels(state, action) {
            state.channels = action.payload;
        },
    },
});

export const { selectChannel, selectDM, setChannels } = channelSlice.actions;

export default channelSlice.reducer;
