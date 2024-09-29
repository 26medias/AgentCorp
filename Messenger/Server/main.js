// main.js
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Utility class for file operations
class FileManager {
    constructor(name) {
        if (!name) {
            throw new Error("Name is required for FileManager initialization");
        }
        this.logsDir = './logs';
        this.name = name;
        this.configPath = path.join(this.logsDir, this.name, 'config.json');
        this.init();
    }

    init() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir);
        }
        const logDirPath = path.join(this.logsDir, this.name);
        if (!fs.existsSync(logDirPath)) {
            fs.mkdirSync(logDirPath);
        }
    }

    saveConfig(config) {
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    }

    loadConfig() {
        if (fs.existsSync(this.configPath)) {
            return JSON.parse(fs.readFileSync(this.configPath));
        }
        return { users: {}, channels: {} };
    }

    getChannelLogs(channelName) {
        const logFilePath = path.join(this.logsDir, this.name, 'channel.json');
        if (fs.existsSync(logFilePath)) {
            const logs = JSON.parse(fs.readFileSync(logFilePath, 'utf-8'));
            return logs.filter(log => log.message.channel === channelName);
        }
        return [];
    }

    getDirectMessageLogs(userA, userB) {
        const logsDir = path.join(this.logsDir, this.name);
        const logFiles = [
            path.join(logsDir, `${userA}-to-${userB}.json`),
            path.join(logsDir, `${userB}-to-${userA}.json`)
        ];
        let logs = [];
        logFiles.forEach(logFilePath => {
            if (fs.existsSync(logFilePath)) {
                const fileLogs = JSON.parse(fs.readFileSync(logFilePath, 'utf-8'));
                logs = logs.concat(fileLogs);
            }
        });
        // Sort logs by timestamp
        logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return logs;
    }

    logMessage(file, type, message) {
        const logFilePath = path.join(this.logsDir, this.name, `${file}.json`);
        let logs = [];

        if (fs.existsSync(logFilePath)) {
            const content = fs.readFileSync(logFilePath, 'utf-8');
            try {
                logs = JSON.parse(content);
            } catch (error) {
                logs = [];
            }
        }

        const logEntry = { type, message, timestamp: new Date().toISOString() };
        logs.push(logEntry);

        fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));
    }
}

// Server class for WebSocket management
class MessagingServer {
    constructor(port, loggingEnabled = false) {
        this.clients = {}; // Map of username to WebSocket
        this.channels = {}; // Map of channel name to array of usernames
        this.config = { users: {}, channels: {} };
        this.fileManager = null;
        this.loggingEnabled = loggingEnabled;
        this.wss = new WebSocket.Server({ port: port });

        this.wss.on('connection', (ws) => this.onConnection(ws));
        this.log(`WebSocket server is running on ws://localhost:${port}`);
    }

    setServerName(name) {
        if (!name) {
            throw new Error("Server name is not provided");
        }
        this.fileManager = new FileManager(name);
        this.config = this.fileManager.loadConfig();
        this.channels = this.config.channels;
        this.log(`Loaded config for ${name}`);
        this.log(`Current channels: ${Object.keys(this.channels).join(', ')}`);
    }

    log(message) {
        if (this.loggingEnabled) {
            console.log(message);
        }
    }

    onConnection(ws) {
        ws.on('message', (message) => this.onMessage(ws, message));
        ws.on('close', () => this.onClose(ws));
    }

    onMessage(ws, message) {
        let data;
        try {
            data = JSON.parse(message);
        } catch (error) {
            ws.send(JSON.stringify({ error: "Invalid JSON message" }));
            return;
        }

        switch (data.action) {
            case 'set_name':
                this.setServerName(data.name);
                ws.send(JSON.stringify({ status: "server_name_set", serverName: data.name }));
                break;
            case 'register':
                this.registerUser(ws, data.username);
                break;
            case 'join_channel':
                this.joinChannel(ws, data.channel);
                break;
            case 'send_channel':
                this.sendChannelMessage(ws, data.channel, data.message);
                break;
            case 'send_direct':
                this.sendDirectMessage(ws, data.username, data.recipient, data.message);
                break;
            case 'get_channels':
                this.getChannels(ws);
                break;
            case 'get_users':
                this.getUsers(ws);
                break;
            case 'get_channel_logs':
                this.getChannelLogs(ws, data.channel);
                break;
            case 'get_direct_logs':
                this.getDirectLogs(ws, data.userA, data.userB);
                break;
            case 'get_direct_contacts':
                this.getDirectContacts(ws, data.username);
                break;
            default:
                ws.send(JSON.stringify({ error: "Unknown action" }));
                break;
        }
    }

    onClose(ws) {
        this.cleanup(ws);
    }

    getDirectContacts(ws, username) {
        const logsDir = path.join(this.fileManager.logsDir, this.fileManager.name);
        console.log('Logs directory:', logsDir); // Debugging log
        let files = [];
        try {
            files = fs.readdirSync(logsDir);
        } catch (error) {
            console.error('Error reading logs directory:', error);
        }
        const contacts = new Set();
    
        files.forEach(file => {
            if (file.startsWith(`${username}-to-`) || file.startsWith(`${username}_to_`) || file.endsWith(`-to-${username}.json`) || file.endsWith(`_to_${username}.json`)) {
                const [userA, userB] = file.replace('.json', '').split(/-to-|_to_/);
                if (userA !== username) contacts.add(userA);
                if (userB !== username) contacts.add(userB);
            }
        });
    
        ws.send(JSON.stringify({ action: "get_direct_contacts", contacts: Array.from(contacts) }));
        this.log(`Direct contacts for ${username}: ${Array.from(contacts).join(', ')}`);
    }
    

    registerUser(ws, username) {
        if (!username) {
            ws.send(JSON.stringify({ error: "Username is required" }));
            return;
        }
        this.clients[username] = ws;
        this.config.users[username] = {};
        this.fileManager.saveConfig(this.config);
        ws.send(JSON.stringify({ status: "registered", username }));
        this.log(`User registered: ${username}`);
    }

    joinChannel(ws, channelName) {
        const username = this.getUsernameBySocket(ws);
        if (!username) {
            ws.send(JSON.stringify({ error: "User not registered" }));
            return;
        }
        if (!channelName) {
            ws.send(JSON.stringify({ error: "Channel name is required" }));
            return;
        }
        if (!this.channels[channelName]) {
            this.channels[channelName] = [];
            this.log(`Channel created: ${channelName}`);
        }
        if (!this.channels[channelName].includes(username)) {
            this.channels[channelName].push(username);
            this.log(`User ${username} joined channel ${channelName}`);
        }
        this.config.channels[channelName] = this.channels[channelName];
        this.fileManager.saveConfig(this.config);
        ws.send(JSON.stringify({ status: `joined ${channelName}` }));
    }

    sendChannelMessage(ws, channelName, msg) {
        const username = this.getUsernameBySocket(ws);
        if (!username) {
            ws.send(JSON.stringify({ error: "User not registered" }));
            return;
        }
        if (!channelName || !msg) {
            ws.send(JSON.stringify({ error: "Channel name and message are required" }));
            return;
        }
        if (this.channels[channelName]) {
            this.channels[channelName].forEach(user => {
                const client = this.clients[user];
                if (client && client !== ws) {
                    client.send(JSON.stringify({ action: 'channel_message', channel: channelName, from: username, message: msg }));
                }
            });
            this.log(`Message in channel ${channelName} from ${username}: ${msg}`);
            this.fileManager.logMessage('channel', 'channel', { channel: channelName, from: username, message: msg });
        } else {
            ws.send(JSON.stringify({ error: `Channel ${channelName} does not exist` }));
        }
    }

    sendDirectMessage(ws, from, recipient, msg) {
        if (!from || !recipient || !msg) {
            ws.send(JSON.stringify({ error: "From, recipient, and message are required" }));
            return;
        }
        const recipientSocket = this.clients[recipient];
        if (recipientSocket) {
            recipientSocket.send(JSON.stringify({ action: 'direct_message', from, message: msg }));
            const fileName = `${from}-to-${recipient}`;
            this.log(`DM from ${from} to ${recipient}: ${msg}`);
            this.fileManager.logMessage(fileName, 'direct', { from, to: recipient, message: msg });
        } else {
            ws.send(JSON.stringify({ error: `Recipient ${recipient} is not connected` }));
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

    getChannelLogs(ws, channelName) {
        if (!channelName) {
            ws.send(JSON.stringify({ error: "Channel name is required" }));
            return;
        }
        const logs = this.fileManager.getChannelLogs(channelName);
        ws.send(JSON.stringify({ action: "get_channel_logs", channel: channelName, logs }));
        this.log(`Logs requested for channel ${channelName}`);
    }

    getDirectLogs(ws, userA, userB) {
        if (!userA || !userB) {
            ws.send(JSON.stringify({ error: "Both userA and userB are required" }));
            return;
        }
        const logs = this.fileManager.getDirectMessageLogs(userA, userB);
        ws.send(JSON.stringify({ action: "get_direct_logs", logs }));
        this.log(`Logs requested for direct messages between ${userA} and ${userB}`);
    }

    getUsernameBySocket(ws) {
        return Object.keys(this.clients).find(username => this.clients[username] === ws);
    }

    cleanup(ws) {
        const username = this.getUsernameBySocket(ws);
        if (username) {
            delete this.clients[username];
            for (const channel in this.channels) {
                this.channels[channel] = this.channels[channel].filter(user => user !== username);
            }
            // Do not remove the user from this.config.users
            // Update this.config.channels if necessary
            this.config.channels = this.channels;
            this.fileManager.saveConfig(this.config);
            this.log(`User ${username} disconnected.`);
        }
    }
}

// Initialize the messaging server with logging enabled
const server = new MessagingServer(8080, true);
