const WebSocket = require('ws');

// Helper function to connect to the server
const connect = (username, serverName) => {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:8080');
        
        ws.on('open', () => {
            console.log(`${username} connected to server`);
            ws.send(JSON.stringify({ action: 'set_name', name: serverName }));
            ws.send(JSON.stringify({ action: 'register', username: username }));
            resolve(ws);
        });

        ws.on('error', (error) => {
            console.error(`${username} connection error:`, error);
            reject(error);
        });

        ws.on('close', () => {
            console.log(`${username} disconnected`);
        });

        ws.on('message', (data) => {
            const message = data.toString(); // Decode Buffer to string
            console.log(`${username} received message:`, message);
        });
    });
};

// Helper function to join a channel
const joinChannel = (ws, channel) => {
    ws.send(JSON.stringify({ action: 'join_channel', channel: channel }));
    console.log(`Joined channel ${channel}`);
};

// Helper function to send a channel message
const sendChannelMessage = (ws, channel, message) => {
    ws.send(JSON.stringify({ action: 'send_channel', channel: channel, message: message }));
    console.log(`Sent message to channel ${channel}: ${message}`);
};

// Helper function to send a direct message
const sendDirectMessage = (ws, username, recipient, message) => {
    ws.send(JSON.stringify({ action: 'send_direct', username: username, recipient: recipient, message: message }));
    console.log(`Sent direct message from ${username} to ${recipient}: ${message}`);
};

// Helper function to receive a message from WebSocket
const receiveMessage = (ws) => {
    return new Promise((resolve) => {
        ws.on('message', (data) => {
            const message = JSON.parse(data.toString()); // Decode Buffer to string, then parse
            resolve(message);
        });
    });
};

// Test Channel Messaging
const testChannelMessaging = async () => {
    console.log("Running channel messaging test...");

    // Connect 3 users
    const wsUser1 = await connect('user1', 'test_server');
    const wsUser2 = await connect('user2', 'test_server');
    const wsUser3 = await connect('user3', 'test_server');

    // All users join the same channel
    const channelName = 'test_channel';
    joinChannel(wsUser1, channelName);
    joinChannel(wsUser2, channelName);
    joinChannel(wsUser3, channelName);

    // Send a message from user1 to the channel
    sendChannelMessage(wsUser1, channelName, 'Hello Channel!');

    // Verify all users receive the message
    const msgUser2 = await receiveMessage(wsUser2);
    const msgUser3 = await receiveMessage(wsUser3);

    console.log("User2 received:", msgUser2);
    console.log("User3 received:", msgUser3);

    const expectedMessage = { channel: channelName, message: 'Hello Channel!' };

    if (JSON.stringify(msgUser2) === JSON.stringify(expectedMessage) &&
        JSON.stringify(msgUser3) === JSON.stringify(expectedMessage)) {
        console.log("Channel messaging test passed.");
    } else {
        console.log("Channel messaging test failed.");
    }

    wsUser1.close();
    wsUser2.close();
    wsUser3.close();
};

// Test Direct Messaging
const testDirectMessaging = async () => {
    console.log("Running direct messaging test...");

    // Connect 2 users
    const wsUser1 = await connect('user1', 'test_server');
    const wsUser2 = await connect('user2', 'test_server');

    // Send a direct message from user1 to user2
    sendDirectMessage(wsUser1, 'user1', 'user2', 'Hello User2!');

    // Verify user2 receives the message
    const msgUser2 = await receiveMessage(wsUser2);

    console.log("User2 received:", msgUser2);

    const expectedMessage = { direct_message: 'Hello User2!', from: 'user1' };

    if (JSON.stringify(msgUser2) === JSON.stringify(expectedMessage)) {
        console.log("Direct messaging test passed.");
    } else {
        console.log("Direct messaging test failed.");
    }

    wsUser1.close();
    wsUser2.close();
};

// Run all tests
const runTests = async () => {
    await testChannelMessaging();
    await testDirectMessaging();
};

runTests();
