import fs from 'fs';
import MessengerClient from './MessengerClient.js';
import Embeddings from './Embeddings.js'
import GPTService from './GPTService.js';
import History from './History.js';
import MessageStatus from './MessageStatus.js';
import Tree from './Tree.js';

class Agent {
    constructor(workspace_directory, username) {
        this.workspace_directory = workspace_directory;
        this.username = username;
    }

    async init() {
        this.metadata   = JSON.parse(fs.readFileSync(`${this.workspace_directory}/agents/${this.username}.json`, 'utf8'));
        this.project    = JSON.parse(fs.readFileSync(`${this.workspace_directory}/project.json`, 'utf8'));
        
        this.memory     = new Embeddings(`${this.workspace_directory}/agents/embeddings/${this.username}`); // Embeddings store
        this.history    = new History(`${this.workspace_directory}/agents/history/${this.username}`); // History store
        this.msgStatus  = new MessageStatus(); // Async message state management
        this.tree       = new Tree(); // Thread tree
        this.gpt        = new GPTService(process.env.OPENAI_API_KEY); // GPT wrapper
        await this.connectToMessenger();
    }

    async connectToMessenger(messenger_server='ws://localhost:8080') {
        const scope = this;
        this.client = new MessengerClient(messenger_server, this.username);
        this.client.connect(this.project.project.name);

        this.client.on('directMessage', (message, from) => {
            scope.onDM(message, from);
        });
        
        this.client.on('channelMessage', (message, from, channel) => {
            scope.onMessage(message, from, channel);
        });

        this.client.on('close', () => {
            console.log('Connection closed');
        });

        return new Promise((resolve, reject) => {
            scope.client.on('open', () => {
                for (let i in scope.metadata.messenger_channels) {
                    scope.client.joinChannel(scope.metadata.messenger_channels[i]);
                }
                resolve(true);
            });
            scope.client.on('error', (err) => {
                reject(err);
            });
        });
    }

    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async sendDM(to, msg, request_reply, threadId) {
        const msgId = this.uuid();
        const msg = JSON.stringify({
            msgId,
            threadId,
            msg,
            request_reply
        });
        this.client.DM(to, msg);
        // Track the reply status
        if (request_reply && request_reply) {
            this.msgStatus.start({
                name: msgId,
                from: [to]
            });
        }
    }

    async sendChannelMessage(channel, msg, request_reply, threadId) {
        const msgId = this.uuid();
        const msg = JSON.stringify({
            msgId,
            threadId,
            msg,
            request_reply
        });
        this.client.send(channel, msg);
        // Track the reply status
        if (request_reply && request_reply.length>0) {
            this.msgStatus.start({
                name: msgId,
                from: request_reply
            });
        }
    }

    parseMessage(message) {
        /*
            {
                "msgId": "4d977bd9-8f20-4c4a-815a-dbb63ed232a2",
                "threadId": "179ec08f-6812-4657-a330-4a8f972d530a",
                "msg": "Review the code in `main.js`",
                "request_reply": ["userA", "userB"]
            }
        */
        const msg = JSON.parse(message);
        return msg
    }

    async newThinkThread(options) {
        options = {
            type: 'startup',
            prompt: null,
            from: null,
            channel: null,
            isDM: null,
            ...options
        };

        const system_prompt = this.gpt.getPrompt("./prompts/system.txt"); //@todo: assemble

        const response = await this.gpt.ask(system_prompt, options.prompt);
        if (!response.next_steps && !response.actions) {
            return true;
        } else {
            // has actions
            const actionResponse = await this.executeActions(response); // @todo
            return await this.newThinkThread({
                ...options,
                type: 'action_response',
                prompt: actionResponse
            })
        }
    }

    async onDM(message, from) {
        const scope = this;
        console.log("DM:", { message, from });
        const { msgId, threadId, msg, request_reply } = this.parseMessage(message);
        // Record the message
        const { eid, embeddings } = await this.memory.store(msg, { from, isDM: true, msgId, threadId });
        await this.history.add(msg, { from, isDM: true, eid, msgId, threadId });
        // Need to act on it?
        if (request_reply) {
            // Action requested
            // Start a thread
            this.tree.branch(msgId, null, (payload) => {
                // Reply with the thread's message
                scope.sendDM(from, payload, false, msgId)
                // @todo: Run the thread, close the branch
            })
        }
        // Is it a response to a thread we have?
        if (this.msgStatus.has(threadId)) {
            // Response to a thread
            const isDone = await this.msgStatus.done(threadId, from);
            if (isDone) {
                // We got all the answers we were waiting for
                //

            }
        }
    }

    async onMessage(message, from, channel) {
        console.log("Channel:", { message, from, channel });
        const { msgId, threadId, msg, request_reply } = this.parseMessage(message);
        // Record the message
        const { eid, embeddings } = await this.memory.store(msg, { from, channel, msgId, threadId });
        await this.history.add(msg, { from, channel, isDM: false, eid, msgId, threadId });
        // Need to act on it?
        if (request_reply.includes(this.username)) {
            // Action requested
            await this.newThinkThread({
                type: 'channel_message',
                prompt: msg,
                from,
                channel,
                isDM: false
            })
        }
        // Is it a response to a thread we have?
        if (this.msgStatus.has(threadId)) {
            // Response to a thread
            const isDone = await this.msgStatus.done(threadId, from);
            if (isDone) {
                if (this.tree.areBranchesCompleted(threadId)) {
                    
                }
            }
        }
    }
}

(async () => {
    const agent = new Agent('../workspaces/europa-discovery', 'PM')
    await agent.init();
})()
