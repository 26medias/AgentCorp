// main.js
const MessengerClient = require('./MessengerClient');

const client = new MessengerClient('ws://localhost:8080', 'my_username');

client.on('open', () => {
    // Now the connection is open
    client.joinChannel('general');
    client.send('general', 'Yoooo!');
    client.DM('userTest', 'What\'s up?');
});

client.on('directMessage', (message, from) => {
    console.log("DM:", { message, from });
});

client.on('channelMessage', (message, from, channel) => {
    console.log("Channel:", { message, from, channel });
});

client.on('error', (error) => {
    console.error('WebSocket error:', error);
});

client.on('close', () => {
    console.log('Connection closed');
});
