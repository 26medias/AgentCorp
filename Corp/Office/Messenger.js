// MessagingServer.js
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import DatabaseManager from './DatabaseManager.js'; // Ensure correct path

// Get __dirname and __filename equivalents in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MessagingServer {
    constructor(port, storageDir, loggingEnabled = false) {
        this.clients = {}; // Map of username to WebSocket
        this.channels = {}; // Map of channel name to array of usernames
        this.config = { users: {}, channels: {} };
        this.loggingEnabled = loggingEnabled;
        this.handQueue = []; // Queue for hand-raising, now stores objects { username, data }
        this.activeUser = null; // Currently active user

        // Initialize DatabaseManager
        this.dbManager = new DatabaseManager('messaging_server', storageDir);

        // Initialize WebSocket Server
        this.wss = new WebSocketServer({ port: port });

        this.wss.on('connection', (ws) => this.onConnection(ws));
        this.log(`WebSocket server is running on ws://localhost:${port}`);
    }

    log(message) {
        if (this.loggingEnabled) {
            console.log(message);
        }
    }

    async onConnection(ws) {
        ws.on('message', (message) => this.onMessage(ws, message));
        ws.on('close', () => this.onClose(ws));
    }

    async onMessage(ws, message) {
        let data;
        try {
            data = JSON.parse(message);
        } catch (error) {
            ws.send(JSON.stringify({ error: "Invalid JSON message" }));
            return;
        }

        switch (data.action) {
            case 'register':
                await this.registerUser(ws, data.username);
                break;
            case 'join_channel':
                await this.joinChannel(ws, data.channel);
                break;
            case 'raise_hand':
                await this.handleRaiseHand(ws, data.data); // Pass the 'data' field
                break;
            case 'send_message':
                await this.handleSendMessage(ws, data.message, data.channel);
                break;
            case 'send_direct':
                await this.sendDirectMessage(ws, data.username, data.recipient, data.message);
                break;
            case 'get_channels':
                this.getChannels(ws);
                break;
            case 'get_users':
                this.getUsers(ws);
                break;
            case 'get_channel_logs':
                await this.getChannelLogs(ws, data.channel, data.query, data.sort);
                break;
            case 'get_direct_logs':
                await this.getDirectLogs(ws, data.userA, data.userB, data.query, data.sort);
                break;
            case 'get_direct_contacts':
                this.getDirectContacts(ws, data.username);
                break;
            case 'get_similar_channel_messages':
                await this.getSimilarChannelMessages(ws, data.queryText, data.channels, data.limit);
                break;
            case 'get_similar_direct_messages':
                await this.getSimilarDirectMessages(ws, data.queryText, data.user, data.limit);
                break;
            default:
                ws.send(JSON.stringify({ error: "Unknown action" }));
                break;
        }
    }

    async handleRaiseHand(ws, handData) { // Updated to accept 'data'
        const username = this.getUsernameBySocket(ws);
        if (!username) {
            ws.send(JSON.stringify({ error: "User not registered" }));
            return;
        }

        if (this.handQueue.find(entry => entry.username === username) || this.activeUser === username) {
            ws.send(JSON.stringify({ status: "already_in_queue_or_active" }));
            return;
        }

        // Store both username and the associated data
        this.handQueue.push({ username, data: handData });
        this.log(`User ${username} raised hand with data: "${handData}". Queue length: ${this.handQueue.length}`);

        // If no active user, grant turn immediately
        if (!this.activeUser) {
            this.grantTurn();
        } else {
            const position = this.handQueue.length;
            ws.send(JSON.stringify({ status: "queued", position }));
        }
    }

    async handleSendMessage(ws, msg, channel) {
        const username = this.getUsernameBySocket(ws);
        //console.log(`[server] [ch:${channel}][u:${username}] ${msg}`)
        if (!username) {
            console.log({ error: "User not registered" })
            ws.send(JSON.stringify({ error: "User not registered" }));
            return;
        }

        /*if (this.activeUser !== username) {
            ws.send(JSON.stringify({ error: "Not your turn to send messages" }));
            return;
        }*/

        if (!msg) {
            console.log({ error: "Message is required" })
            ws.send(JSON.stringify({ error: "Message is required" }));
            return;
        }

        const timestamp = new Date().toISOString();

        try {
            // Store message and embedding
            let messageId;
            if (channel && msg) {
                await this.dbManager.addChannel(channel); // Ensure channel exists
                messageId = await this.dbManager.logChannelMessage(channel, username, msg, timestamp);
                this.sendChannelMessage(ws, channel, JSON.stringify({ msg, msgId: messageId }));
            } else if (msg.recipient && msg) { // buggy
                messageId = await this.dbManager.logDirectMessage(username, msg.recipient, msg, timestamp);
                await this.sendDirectMessage(ws, username, msg.recipient, JSON.stringify({ msg, msgId: messageId }), messageId, timestamp);
            } else {
                ws.send(JSON.stringify({ error: "Invalid message format" }));
                return;
            }

            //console.log(`[${messageId}][${username}][${channel}] ${msg}`);

            // After sending the message, grant turn to the next user in the queue
            this.grantTurn();
        } catch (error) {
            console.error("Error handling send_message:", error);
            ws.send(JSON.stringify({ error: "Failed to send message" }));
        }
    }

    async sendDirectMessage(ws, from, recipient, msg, messageId = null, timestamp = null) {
        if (!from || !recipient || !msg) {
            ws.send(JSON.stringify({ error: "From, recipient, and message are required" }));
            return;
        }
        const recipientSocket = this.clients[recipient];
        if (recipientSocket) {
            recipientSocket.send(JSON.stringify({ action: 'direct_message', from, message: msg }));
            this.log(`DM from ${from} to ${recipient}: ${msg}`);

            // If messageId and timestamp are not provided, they should have been generated in handleSendMessage
            if (messageId && timestamp) {
                ws.send(JSON.stringify({ status: "direct_message_sent", messageId }));
            } else {
                ws.send(JSON.stringify({ error: "Failed to generate message ID or timestamp" }));
            }
        } else {
            ws.send(JSON.stringify({ error: `Recipient ${recipient} is not connected` }));
        }
    }

    sendChannelMessage(ws, channelName, msg) {
        //console.log(`[sendChannelMessage]`, {channelName, msg})
        if (this.channels[channelName]) {
            this.channels[channelName].forEach(user => {
                //console.log(">>", user)
                const client = this.clients[user];
                if (client && client !== ws) {
                    client.send(JSON.stringify({ action: 'channel_message', channel: channelName, from: this.getUsernameBySocket(ws), message: msg }));
                }
            });
            this.log(`Message in channel ${channelName}: ${msg}`);
        } else {
            console.log({ error: `Channel ${channelName} does not exist` })
            ws.send(JSON.stringify({ error: `Channel ${channelName} does not exist` }));
        }
    }

    getChannels(ws) {
        const channels = Object.keys(this.channels);
        ws.send(JSON.stringify({ action: "get_channels", channels }));
        this.log(`Channels requested. Current channels: ${channels.join(', ')}`);
    }

    getUsers(ws) {
        const users = Object.keys(this.config.users); // Get all registered users
        ws.send(JSON.stringify({ action: "get_users", users }));
        this.log(`Users requested. Registered users: ${users.join(', ')}`);
    }

    async getChannelLogs(ws, channelName, query = {}, sort = 'ASC') {
        if (!channelName) {
            ws.send(JSON.stringify({ error: "Channel name is required" }));
            return;
        }
        try {
            const logs = await this.dbManager.getChannelLogs(channelName, query, sort);
            ws.send(JSON.stringify({ action: "get_channel_logs", channel: channelName, logs }));
            this.log(`Logs requested for channel ${channelName}`);
        } catch (error) {
            ws.send(JSON.stringify({ error: "Error retrieving channel logs" }));
            this.log(`Error retrieving channel logs: ${error}`);
        }
    }

    async getDirectLogs(ws, userA, userB, query = {}, sort = 'ASC') {
        if (!userA || !userB) {
            ws.send(JSON.stringify({ error: "Both userA and userB are required" }));
            return;
        }
        try {
            const logs = await this.dbManager.getDirectLogs(userA, userB, query, sort);
            ws.send(JSON.stringify({ action: "get_direct_logs", logs }));
            this.log(`Logs requested for direct messages between ${userA} and ${userB}`);
        } catch (error) {
            ws.send(JSON.stringify({ error: "Error retrieving direct logs" }));
            this.log(`Error retrieving direct logs: ${error}`);
        }
    }

    getDirectContacts(ws, username) {
        // Fetch unique contacts from direct_messages where username is either fromUser or toUser
        this.dbManager.db.all(`
            SELECT DISTINCT 
                CASE 
                    WHEN fromUser = ? THEN toUser 
                    ELSE fromUser 
                END AS contact 
            FROM direct_messages 
            WHERE fromUser = ? OR toUser = ?
        `, [username, username, username], (err, rows) => {
            if (err) {
                ws.send(JSON.stringify({ error: "Error fetching direct contacts" }));
                this.log(`Error fetching direct contacts for ${username}: ${err}`);
                return;
            }
            const contacts = rows.map(row => row.contact);
            ws.send(JSON.stringify({ action: "get_direct_contacts", contacts }));
            this.log(`Direct contacts for ${username}: ${contacts.join(', ')}`);
        });
    }

    async getSimilarChannelMessages(ws, queryText, channels = [], limit = 5) {
        if (!queryText) {
            ws.send(JSON.stringify({ error: "Query text is required for similarity search" }));
            return;
        }

        try {
            // Retrieve similar channel messages
            const similarMessages = await this.dbManager.getSimilarChannelMessages(queryText, channels, limit);

            ws.send(JSON.stringify({ action: "similar_channel_messages", results: similarMessages }));
            this.log(`Similarity search in channels: ${channels.join(', ')} for query: "${queryText}"`);
        } catch (error) {
            console.error("Error in getSimilarChannelMessages:", error);
            ws.send(JSON.stringify({ error: "Error retrieving similar channel messages" }));
        }
    }

    async getSimilarDirectMessages(ws, queryText, user, limit = 5) {
        if (!queryText) {
            ws.send(JSON.stringify({ error: "Query text is required for similarity search" }));
            return;
        }

        if (!user) {
            ws.send(JSON.stringify({ error: "User is required for similarity search in DMs" }));
            return;
        }

        try {
            // Retrieve similar direct messages
            const similarMessages = await this.dbManager.getSimilarDMs(queryText, user, limit);

            ws.send(JSON.stringify({ action: "similar_direct_messages", results: similarMessages }));
            this.log(`Similarity search in DMs for user: ${user} and query: "${queryText}"`);
        } catch (error) {
            console.error("Error in getSimilarDirectMessages:", error);
            ws.send(JSON.stringify({ error: "Error retrieving similar direct messages" }));
        }
    }

    async registerUser(ws, username) {
        if (!username) {
            ws.send(JSON.stringify({ error: "Username is required" }));
            return;
        }
        this.clients[username] = ws;
        this.config.users[username] = {};

        // Add user to the database
        await this.dbManager.addUser(username);

        ws.send(JSON.stringify({ status: "registered", username }));
        this.log(`User registered: ${username}`);
    }

    async joinChannel(ws, channelName) {
        const username = this.getUsernameBySocket(ws);
        if (!username) {
            ws.send(JSON.stringify({ error: "User not registered" }));
            return;
        }
        if (!channelName) {
            ws.send(JSON.stringify({ error: "Channel name is required" }));
            return;
        }
        await this.dbManager.addChannel(channelName); // Ensure channel exists
        if (!this.channels[channelName]) {
            this.channels[channelName] = [];
            this.log(`Channel created: ${channelName}`);
        }
        if (!this.channels[channelName].includes(username)) {
            this.channels[channelName].push(username);
            this.log(`User ${username} joined channel ${channelName}`);
        }
        this.config.channels[channelName] = this.channels[channelName];
        // If you're saving config elsewhere, implement saving logic here
        ws.send(JSON.stringify({ status: `joined ${channelName}` }));
    }

    async onClose(ws) {
        this.cleanup(ws);
    }

    getUsernameBySocket(ws) {
        return Object.keys(this.clients).find(username => this.clients[username] === ws);
    }

    cleanup(ws) {
        const username = this.getUsernameBySocket(ws);
        if (username) {
            delete this.clients[username];
            // Remove user from all channels
            for (const channel in this.channels) {
                this.channels[channel] = this.channels[channel].filter(user => user !== username);
            }
            // Remove user from handQueue if present
            const queueIndex = this.handQueue.findIndex(entry => entry.username === username);
            if (queueIndex !== -1) {
                this.handQueue.splice(queueIndex, 1);
                this.log(`User ${username} removed from hand-raising queue.`);
            }
            // If the active user disconnects, grant turn to the next user
            if (this.activeUser === username) {
                this.activeUser = null;
                this.grantTurn();
            }
            // Update config and save
            this.config.channels = this.channels;
            // Implement saving config if needed
            this.log(`User ${username} disconnected.`);
        }
    }

    grantTurn() {
        if (this.handQueue.length === 0) {
            this.activeUser = null;
            return;
        }

        const nextEntry = this.handQueue.shift(); // Get the next { username, data } object
        const nextUser = nextEntry.username;
        const handData = nextEntry.data;

        this.activeUser = nextUser;

        const nextSocket = this.clients[nextUser];
        if (nextSocket) {
            nextSocket.send(JSON.stringify({ action: "your_turn", username: nextUser, data: handData }));
            this.log(`Granted turn to ${nextUser} with data: "${handData}"`);
        } else {
            this.log(`User ${nextUser} is not connected. Skipping turn.`);
            this.grantTurn(); // Recursively grant turn to the next user
        }
    }
}

export default MessagingServer;
