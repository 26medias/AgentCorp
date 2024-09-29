# WebSocket Messaging Server Documentation

This document provides the necessary information to interact with the WebSocket-based messaging server. It includes details on server setup, WebSocket actions, and client implementation.

## Table of Contents
- [Server Setup](#server-setup)
- [WebSocket Actions](#websocket-actions)
  - [Set Server Name](#set-server-name)
  - [Register User](#register-user)
  - [Join Channel](#join-channel)
  - [Send Channel Message](#send-channel-message)
  - [Send Direct Message](#send-direct-message)
  - [Get Channels](#get-channels)
  - [Get Users](#get-users)
  - [Get Channel Logs](#get-channel-logs)
  - [Get Direct Logs](#get-direct-logs)
- [Client Implementation](#client-implementation)
  - [Connect to Server](#connect-to-server)
  - [Example Client](#example-client)

## Server Setup

The messaging server is built using Node.js and WebSockets. It supports channel-based communication (one-to-many) and direct messaging (one-to-one) between users. It also supports logging and restoring server state by saving configurations based on a provided `name`.

### Requirements

1. Node.js (v12+)
2. Dependencies:
   - ws (WebSocket library)
   - fs (File system for logging)
   - path (File path management)

### Running the Server

Make sure the server is running on your machine by executing:

    node server.js

This will start the WebSocket server on ws://localhost:8080.

## WebSocket Actions

### Set Server Name

The first message a client should send is to set the server name. The server will load or create a configuration file under ./logs/{name}.

Action:
    
    {
      "action": "set_name",
      "name": "my_server"
    }

### Register User

A client must register with a username before joining a channel or sending messages.

Action:

    {
      "action": "register",
      "username": "user1"
    }

### Join Channel

A user can join a specific channel by providing the channel name. This action will subscribe the user to that channel's messages.

Action:

    {
      "action": "join_channel",
      "channel": "channel_name"
    }

### Send Channel Message

To send a message to all users subscribed to a particular channel, the client must specify the channel and the message content.

Action:

    {
      "action": "send_channel",
      "channel": "channel_name",
      "message": "Hello, Channel!"
    }

### Send Direct Message

To send a direct message to a specific user, the client must specify the recipient and the message content.

Action:

    {
      "action": "send_direct",
      "username": "sender",
      "recipient": "recipient_user",
      "message": "Hello, User!"
    }

### Get Channels

Retrieve the list of all available channels.

Action:

    {
      "action": "get_channels"
    }

Response:

    {
      "action": "get_channels",
      "channels": ["channel1", "channel2"]
    }

### Get Users

Retrieve the list of all registered users.

Action:

    {
      "action": "get_users"
    }

Response:

    {
      "action": "get_users",
      "users": ["user1", "user2"]
    }

### Get Channel Logs

Retrieve the message logs for a specific channel.

Action:

    {
      "action": "get_channel_logs",
      "channel": "channel1"
    }

Response:

    {
      "action": "get_channel_logs",
      "channel": "channel1",
      "logs": [
        {
          "type": "channel",
          "message": {
            "channel": "channel1",
            "from": "user1",
            "message": "Hello Channel!"
          },
          "timestamp": "2024-09-29T12:34:56Z"
        }
      ]
    }

### Get Direct Logs

Retrieve the direct message logs between two users.

Action:

    {
      "action": "get_direct_logs",
      "userA": "user1",
      "userB": "user2"
    }

Response:

    {
      "action": "get_direct_logs",
      "logs": [
        {
          "type": "direct",
          "message": {
            "from": "user1",
            "to": "user2",
            "message": "Hello, User2!"
          },
          "timestamp": "2024-09-29T12:34:56Z"
        }
      ]
    }

## Client Implementation

### Connect to Server

Clients will need to connect to the WebSocket server located at ws://localhost:8080. Upon connection, the client should perform the following sequence:

1. **Set Server Name**
2. **Register User**
3. Optionally **Join a Channel**
4. Send/Receive messages via channels or direct messaging
5. Retrieve channels, users, and past logs as needed

### Example Client

Here’s a basic JavaScript client implementation using the WebSocket API.

    const WebSocket = require('ws');

    // Connect to the WebSocket server
    const ws = new WebSocket('ws://localhost:8080');

    // Set up event listeners for WebSocket
    ws.on('open', () => {
        // Set the server name (use a unique name for each server instance)
        ws.send(JSON.stringify({ action: 'set_name', name: 'my_server' }));

        // Register a user with a unique username
        ws.send(JSON.stringify({ action: 'register', username: 'user1' }));

        // Join a channel
        ws.send(JSON.stringify({ action: 'join_channel', channel: 'general' }));

        // Send a message to the channel
        ws.send(JSON.stringify({ action: 'send_channel', channel: 'general', message: 'Hello, Channel!' }));

        // Send a direct message to another user
        ws.send(JSON.stringify({ action: 'send_direct', username: 'user1', recipient: 'user2', message: 'Hi user2!' }));

        // Retrieve the list of users
        ws.send(JSON.stringify({ action: 'get_users' }));

        // Retrieve the list of channels
        ws.send(JSON.stringify({ action: 'get_channels' }));

        // Retrieve channel logs
        ws.send(JSON.stringify({ action: 'get_channel_logs', channel: 'general' }));

        // Retrieve direct logs
        ws.send(JSON.stringify({ action: 'get_direct_logs', userA: 'user1', userB: 'user2' }));
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

### Example WebSocket Actions

1. **Setting the server name:**

    { "action": "set_name", "name": "my_server" }

2. **Registering a user:**

    { "action": "register", "username": "user1" }

3. **Joining a channel:**

    { "action": "join_channel", "channel": "general" }

4. **Sending a message to a channel:**

    { "action": "send_channel", "channel": "general", "message": "Hello, everyone!" }

5. **Sending a direct message to another user:**

    { "action": "send_direct", "username": "user1", "recipient": "user2", "message": "Hi user2!" }

6. **Retrieving the list of users:**

    { "action": "get_users" }

7. **Retrieving the list of channels:**

    { "action": "get_channels" }

8. **Retrieving channel logs:**

    { "action": "get_channel_logs", "channel": "general" }

9. **Retrieving direct message logs between two users:**

    { "action": "get_direct_logs", "userA": "user1", "userB": "user2" }

## Conclusion

The WebSocket messaging server allows multiple users to communicate through channels or direct messages. By following the provided actions and examples, developers can easily implement a client to interact with the server, retrieve past messages, and display the list of users and channels. Make sure to correctly handle registration, channel subscription, messaging, and retrieving logs based on the available WebSocket actions.

For any questions or issues, please refer to the server logs under ./logs/{name} for debugging information.
