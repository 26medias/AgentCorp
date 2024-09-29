// src/store/slices/userSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    currentUser: 'moderator',
    users: [],
    directContacts: [],
};

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setCurrentUser(state, action) {
            state.currentUser = action.payload;
        },
        setUsers(state, action) {
            state.users = action.payload;
        },
        setDirectContacts(state, action) {
            state.directContacts = action.payload;
        },
    },
});

export const { setCurrentUser, setUsers, setDirectContacts } = userSlice.actions;

export default userSlice.reducer;
