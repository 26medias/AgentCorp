// src/utils/websocket.js
import { setUsers, setDirectContacts } from '../store/slices/userSlice';
import { setChannels } from '../store/slices/channelSlice';
import { setMessages } from '../store/slices/messageSlice';

let ws;
let dispatch;
let currentUser = 'moderator';

const connectWebSocket = (serverName, user, storeDispatch) => {
    dispatch = storeDispatch;
    currentUser = user || 'moderator';

    if (ws) {
        ws.close();
    }

    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'set_name', name: serverName }));
        ws.send(JSON.stringify({ action: 'register', username: currentUser }));
        fetchUsers();
        fetchChannels();
        fetchDirectContacts(currentUser); // Moved here
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received data:', data); // For debugging
        switch (data.action) {
            case 'get_users':
                dispatch(setUsers(data.users));
                break;
            case 'get_channels':
                dispatch(setChannels(data.channels));
                break;
            case 'get_channel_logs':
            case 'get_direct_logs':
                dispatch(setMessages(data.logs));
                break;
            case 'get_direct_contacts':
                dispatch(setDirectContacts(data.contacts));
                break;
            default:
                break;
        }
    };

    ws.onclose = () => {
        // Optional: handle WebSocket close event
    };
};

export const fetchUsers = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'get_users' }));
    }
};

export const fetchChannels = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'get_channels' }));
    }
};

export const fetchChannelLogs = (channel) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'get_channel_logs', channel }));
    }
};

export const fetchDirectLogs = (userA, userB) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'get_direct_logs', userA, userB }));
    }
};

export const fetchDirectContacts = (username) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'get_direct_contacts', username }));
    }
};

export default connectWebSocket;
