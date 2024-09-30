// MessengerClient.js
const WebSocket = require('ws');
const EventEmitter = require('events');

class MessengerClient extends EventEmitter {
    constructor(url, username) {
        super();
        this.url = url;
        this.username = username;
        this.ws = null;

        this.connect();
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
            // Set server name
            this.ws.send(JSON.stringify({ action: 'set_name', name: 'test_server' }));

            // Register the user
            this.ws.send(JSON.stringify({ action: 'register', username: this.username }));

            // Emit 'open' event
            this.emit('open');
        });

        this.ws.on('message', (data) => {
            const message = JSON.parse(data);
            this.handleMessage(message);
        });

        this.ws.on('close', () => {
            this.emit('close');
            console.log('Disconnected from server');
        });

        this.ws.on('error', (error) => {
            this.emit('error', error);
            console.error('WebSocket error:', error);
        });
    }

    handleMessage(message) {
        //console.log('Received message:', message); // For debugging

        switch (message.action) {
            case 'direct_message':
                this.emit('directMessage', message.message, message.from);
                break;
            case 'channel_message':
                this.emit('channelMessage', message.message, message.from, message.channel);
                break;
            default:
                // Handle other actions or status messages if needed
                //console.log('Unhandled message action:', message.action);
                break;
        }
    }

    DM(recipient, message) {
        const msg = {
            action: 'send_direct',
            username: this.username,
            recipient: recipient,
            message: message
        };
        this.ws.send(JSON.stringify(msg));
    }

    send(channel, message) {
        const msg = {
            action: 'send_channel',
            channel: channel,
            message: message
        };
        this.ws.send(JSON.stringify(msg));
    }

    joinChannel(channel) {
        const msg = {
            action: 'join_channel',
            channel: channel
        };
        this.ws.send(JSON.stringify(msg));
    }
}

module.exports = MessengerClient;
