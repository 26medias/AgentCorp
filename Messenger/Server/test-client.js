const WebSocket = require('ws');

// Connect to the WebSocket server
const ws = new WebSocket('ws://localhost:8080');

// Set up event listeners for WebSocket
ws.on('open', () => {
    // Set the server name (use a unique name for each server instance)
    ws.send(JSON.stringify({ action: 'set_name', name: 'test_server'}, null, 4));

    // Register a user with a unique username
    ws.send(JSON.stringify({ action: 'register', username: 'userTest'}, null, 4));

    // Join a channel
    ws.send(JSON.stringify({ action: 'join_channel', channel: 'general'}, null, 4));
    ws.send(JSON.stringify({ action: 'join_channel', channel: 'debug'}, null, 4));

    // Send a message to the channel
    ws.send(JSON.stringify({ action: 'send_channel', channel: 'general', message: 'Hello, Channel!'}, null, 4));
    ws.send(JSON.stringify({ action: 'send_channel', channel: 'general', message: 'Anybody here?'}, null, 4));
    ws.send(JSON.stringify({ action: 'send_channel', channel: 'debug', message: 'wow!'}, null, 4));

    // Send a direct message to another user
    ws.send(JSON.stringify({ action: 'send_direct', username: 'userTest', recipient: 'user2', message: 'Hi user2!'}, null, 4));
    ws.send(JSON.stringify({ action: 'send_direct', username: 'userTest', recipient: 'user2', message: 'What\'s up?'}, null, 4));

    // Retrieve the list of users
    ws.send(JSON.stringify({ action: 'get_users'}, null, 4));

    // Retrieve the list of channels
    ws.send(JSON.stringify({ action: 'get_channels'}, null, 4));

    // Retrieve channel logs
    ws.send(JSON.stringify({ action: 'get_channel_logs', channel: 'general'}, null, 4));

    // Retrieve direct logs
    ws.send(JSON.stringify({ action: 'get_direct_logs', userA: 'userTest', userB: 'user2'}, null, 4));
});

// Receive messages from the server
ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message);
});

// Handle WebSocket errors
ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

// Close the WebSocket connection
ws.on('close', () => {
    console.log('Connection closed');
});