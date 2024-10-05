import fs from 'fs';
import MessengerClient from './MessengerClient.js';
import Embeddings from './Embeddings.js'
import GPTService from './GPTService.js';
import History from './History.js';
import MessageStatus from './MessageStatus.js';
import Tree from './Tree.js';
import WorkspaceOp from './WorkspaceOp.js';

class Agent {
    constructor(workspace_directory, username) {
        this.workspace_directory = workspace_directory;
        this.username = username;
    }

    async init() {
        // TODO: Add error handling for file reads
        this.metadata   = JSON.parse(fs.readFileSync(`${this.workspace_directory}/agents/${this.username}.json`, 'utf8'));
        this.project    = JSON.parse(fs.readFileSync(`${this.workspace_directory}/workspace/project.json`, 'utf8'));
        
        this.memory     = new Embeddings(`${this.workspace_directory}/agents/embeddings/${this.username}`); // Embeddings store
        this.history    = new History(`${this.workspace_directory}/agents/history/${this.username}`); // History store
        this.msgStatus  = new MessageStatus(); // Async message state management
        this.tree       = new Tree(); // Thread tree
        this.gpt        = new GPTService(process.env.OPENAI_API_KEY); // GPT wrapper
        this.ops        = new WorkspaceOp(`${this.workspace_directory}/workspace`);

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
            // TODO: Implement reconnection logic if necessary
        });

        return new Promise((resolve, reject) => {
            scope.client.on('open', () => {
                for (let i in scope.metadata.messenger_channels) {
                    scope.client.joinChannel(scope.metadata.messenger_channels[i]);
                }
                resolve(true);
            });
            scope.client.on('error', (err) => {
                // TODO: Enhance error handling, possibly with retries or alerts
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
        // TODO: Add try-catch to handle JSON parsing errors
        const msg = JSON.parse(message);
        return msg
    }


    async executeActions(actions, threadId=null) {
        let i, j;
        let output = [];
        for (i in actions) {
            const action = actions[i];
            switch (action.action) {
                case "glob":
                    for (j in action.data) {
                        const filename = action.data[j];
                        const response = await this.ops.glob(filename);
                        readBuffer[filename] = JSON.stringify(response)
                    }
                    output.push({
                        action: action.action,
                        output: readBuffer
                    });
                break;
                case "readFiles":
                    const readBuffer = {};
                    for (j in action.data) {
                        const filename = action.data[j];
                        const response = await this.ops.readFile(filename);
                        readBuffer[filename] = response;
                    }
                    output.push({
                        action: action.action,
                        output: readBuffer
                    });
                break;
                case "writeFiles":
                    const writeBuffer = {};
                    for (j in action.data) {
                        const item = action.data[j];
                        const response = await this.ops.writeFile(item.filename, item.content);
                        writeBuffer[item.filename] = response;
                    }
                    output.push({
                        action: action.action,
                        output: writeBuffer
                    });
                break;
                case "runShellCommand":
                    const response = await this.ops.runShellCommand(action.data.command);
                    output.push({
                        action: action.action,
                        output: response
                    });
                break;
                case "sendChannelMessage":
                    for (j in action.data) {
                        const item = action.data[j]
                        await this.sendChannelMessage(item.channel, item.message, action.request_reply, threadId);
                    }
                    output.push({
                        action: action.action,
                        output: true
                    });
                break;
                case "sendDM":
                    for (j in action.data) {
                        const item = action.data[j]
                        await this.sendDM(item.to, item.message, action.request_reply, threadId);
                    }
                    output.push({
                        action: action.action,
                        output: true
                    });
                break;
                default:
                    output.push({
                        action: action.action,
                        output: "Unknown action"
                    });
                break;
            }
        }
        return output;
    }

    async getHistoryContext(options, limit) {
        // Get the channel history
        const history = await this.history.get({channel: options.channel}, limit);
        const messages = history.map(message => {
            return `[${message.metadata.from}] ${message.content}`;
        }).join("\n");
        const msgIds = history.map(item => item.id);
        let contextPrompt;
        if (!options.isDM) {
            contextPrompt = this.gpt.getPrompt("./prompts/channel__context__history.txt", {...options, messages});
        } else {
            contextPrompt = this.gpt.getPrompt("./prompts/DM__context__history.txt", {...options, messages});
        }
        return {contextPrompt, msgIds};
    }

    async getRelevantContext(options, limit, excludeIds) {
        // Find the most relevant messages accross every channels & DMs
        let history = await this.memory.match(options.prompt, limit);
        // Exclude the ones within `excludeIds`
        history = history.filter(item => !excludeIds.contains(item.id));
        const msgIds = history.map(item => item.id);
        messages = history.map(message => {
            return `[${message.metas.channel}][${message.metas.from}] ${message.content}`;
        }).join("\n");
        const contextPrompt = this.gpt.getPrompt("./prompts/context__relevant.txt", {...options, messages});
        return {contextPrompt, msgIds};
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

        const response = await this.gpt.callGPT(system_prompt, options.prompt); //await this.gpt.ask(system_prompt, options.prompt);
        if (!response.next_steps && !response.actions) {
            return true;
        } else {
            // has actions
            const actionResponse = await this.executeActions(response);
            return await this.newThinkThread({
                ...options,
                type: 'action_loop',
                prompt: actionResponse
            })
        }
    }

    async sendDM(to, message, request_reply, threadId) {
        const msgId = this.uuid();
        const msg = JSON.stringify({
            msgId,
            threadId,
            msg: message,
            request_reply
        });
        this.client.DM(to, msg);

        // Record the message
        const { eid, embeddings } = await this.memory.store(message, { from: this.username, to, channel: `${this.username}_${to}`, isDM: true, msgId, threadId });
        await this.history.add(message, { from: this.username, to, channel: `${this.username}_${to}`, isDM: true, eid, msgId, threadId });

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
                        prompt: message,
                        threadId,
                        from: this.username,
                        to,
                        isDM: true
                    })
                }
            });
        }
    }

    async sendChannelMessage(channel, message, request_reply, threadId) {
        const msgId = this.uuid();
        const msg = JSON.stringify({
            msgId,
            threadId,
            msg: message,
            request_reply
        });
        this.client.send(channel, msg);

        // Record the message
        const { eid, embeddings } = await this.memory.store(message, { from: this.username, channel, msgId, threadId });
        await this.history.add(message, { from: this.username, channel, isDM: false, eid, msgId, threadId });

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
                        prompt: message,
                        threadId,
                        from: this.username,
                        channel,
                        isDM: false
                    })
                }
            });
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
                // TODO: This duplicate call to 'done' may be unnecessary
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
            // TODO: Consider handling 'isDone' result if needed
        }
    }
}

export default Agent;
/*
(async () => {
    const agent = new Agent('../workspaces/europa-discovery', 'PM')
    await agent.init();
})()
*/