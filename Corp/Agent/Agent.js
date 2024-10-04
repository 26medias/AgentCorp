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


    async getHistoryContext(options, limit) {
        const history = await this.history.get({channel: options.channel}, limit);
        const messages = history.map(message => {
            return `[${message.metadata.from}] ${message.content}`;
        }).join("\n");
        const msgIds = messages.map(item => item.id);
        let contextPrompt;
        if (!options.isDM) {
            contextPrompt = this.gpt.getPrompt("./prompts/channel__context__history.txt", {...options, messages});
        } else {
            contextPrompt = this.gpt.getPrompt("./prompts/DM__context__history.txt", {...options, messages});
        }
        return {contextPrompt, msgIds};
    }

    async getRelevantContext(options, limit, excludeIds) {
        const history = await this.memory.match(options.prompt, limit);
        const msgIds = messages.map(item => item.id).filter(id => !excludeIds.contains(id));
        let messages = await this.history.getById(msgIds)
        messages = history.map(message => {
            return `[${message.metadata.channel}][${message.metadata.from}] ${message.content}`;
        }).join("\n");
        const contextPrompt = this.gpt.getPrompt("./prompts/context__relevant.txt", {...options, messages});
        return {contextPrompt, msgIds};
    }

    async executeActions(actions) {

    }

    async newThinkThread(options) {
        options = {
            type: 'startup',
            prompt: null,
            threadId: null,
            from: null,
            to: null,
            channel: null,
            isDM: null,
            ...options
        };

        // Fetch the context
        const {historyContext, historyContextMsgIds} = await this.getHistoryContext(options, 25);
        const {relevantContext, relevantContextMsgIds} = await this.getRelevantContext(options, 25, historyContextMsgIds);

        const role_prompt = this.gpt.getPrompt(`./prompts/${options.type}.txt`, {});

        const system_prompt = this.gpt.getPrompt("./prompts/system.txt", {
            role_prompt,
            historyContext,
            relevantContext
        });

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

    async sendDM(to, msg, request_reply, threadId) {
        const msgId = this.uuid();
        const msg = JSON.stringify({
            msgId,
            threadId,
            msg,
            request_reply
        });
        this.client.DM(to, msg);

        // Record the message
        const { eid, embeddings } = await this.memory.store(msg, { from: this.username, to, channel: `${this.username}_${to}`, isDM: true, msgId, threadId });
        await this.history.add(msg, { from: this.username, to, channel: `${this.username}_${to}`, isDM: true, eid, msgId, threadId });

        // Track the reply status
        if (request_reply && request_reply) {
            this.msgStatus.start({
                name: msgId,
                from: [to],
                onComplete: async () => {
                    // We got all our replies, process them
                    //    - Get PM history
                    await this.newThinkThread({
                        type: 'DM__reply-to-request',
                        prompt: msg,
                        threadId,
                        from: this.username,
                        to,
                        isDM: true
                    })
                }
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

        // Record the message
        const { eid, embeddings } = await this.memory.store(msg, { from: this.username, to, channel, msgId, threadId });
        await this.history.add(msg, { from: this.username, channel, isDM: false, eid, msgId, threadId });

        // Track the reply status
        if (request_reply && request_reply.length>0) {
            // Track the expected replies
            this.msgStatus.start({
                name: msgId,
                from: request_reply,
                onComplete: async () => {
                    // We got all our replies, process them
                    //    - Get the 2 relevant messages
                    //    - Get the broader channel context
                    await this.newThinkThread({
                        type: 'channel__replies-to-request',
                        prompt: msg,
                        threadId,
                        from,
                        channel,
                        isDM: false
                    })
                }
            });
            // Create a branch callback
            /*this.tree.branch(msgId, null, async (payload) => {
                
            });*/
        }
    }

    async onDM(message, from) {
        const scope = this;
        console.log("DM:", { message, from });
        const { msgId, threadId, msg, request_reply } = this.parseMessage(message);
        // Record the message
        const { eid, embeddings } = await this.memory.store(msg, { from, to: this.username, channel: `${this.username}_${from}`, isDM: true, msgId, threadId });
        await this.history.add(msg, { from, to: this.username, channel: `${this.username}_${from}`, isDM: true, eid, msgId, threadId });
        // Need to act on it?
        if (request_reply) {
            // Action requested
            await this.newThinkThread({
                type: 'DM__reply-requested',
                prompt: { msgId, threadId, msg, request_reply },
                from,
                isDM: true
            })
        }
        // Is it a response to a thread we have?
        if (this.msgStatus.has(threadId)) {
            // Response to a thread
            const isDone = await this.msgStatus.done(threadId, from);
            if (isDone) {
                // Response to a thread
                // If that's the last expected answer, that thread will continue
                const isDone = await this.msgStatus.done(threadId, from);
            }
        }
    }

    async onMessage(message, from, channel) {
        console.log("Channel:", { message, from, channel });
        const { msgId, threadId, msg, request_reply } = this.parseMessage(message);
        // Record the message
        const { eid, embeddings } = await this.memory.store(msg, { from, to: this.username, channel, msgId, threadId });
        await this.history.add(msg, { from, to: this.username, channel, isDM: false, eid, msgId, threadId });
        // Need to act on it?
        if (request_reply.includes(this.username)) {
            // Action requested
            await this.newThinkThread({
                type: 'channel__reply-requested',
                prompt: { msgId, threadId, msg, request_reply },
                from,
                channel,
                isDM: false
            })
        }
        // Is it a response to a thread we have?
        if (this.msgStatus.has(threadId)) {
            // Response to a thread
            // If that's the last expected answer, that thread will continue
            const isDone = await this.msgStatus.done(threadId, from);
        }
    }
}

(async () => {
    const agent = new Agent('../workspaces/europa-discovery', 'PM')
    await agent.init();
})()
