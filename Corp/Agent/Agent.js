import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

    getFile(relativePath) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        return path.resolve(__dirname, relativePath);
    }

    log(...args) {
        console.log(`[${this.username}]`, ...args);
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

        return await this.connectToMessenger();
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
            scope.log('Connection closed');
            // TODO: Implement reconnection logic if necessary
        });

        return new Promise((resolve, reject) => {
            scope.client.on('open', () => {
                for (let i in scope.metadata.messenger_channels) {
                    scope.client.joinChannel(scope.metadata.messenger_channels[i]);
                    this.log(`[${this.username}] JOINED ${scope.metadata.messenger_channels[i]}`)
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
                case "sendChannelMessages":
                    for (j in action.data) {
                        const item = action.data[j]
                        await this.sendChannelMessage(item.channel, item.message, item.request_reply, threadId);
                    }
                    output.push({
                        action: action.action,
                        output: true
                    });
                break;
                case "sendDMs":
                    for (j in action.data) {
                        const item = action.data[j]
                        await this.sendDM(item.to, item.message, item.request_reply, threadId);
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
        //this.log("getHistoryContext", {options, limit})
        if ((!options.channel && !options.to) || ["startup", "instruct"].includes(options.type)) {
            return {contextPrompt: '', msgIds: []};
        }
        // Get the channel history
        const history = await this.history.get({channel: options.channel}, limit);
        const messages = history.map(message => {
            return `[${message.metadata.from}] ${message.content}`;
        }).join("\n");
        const msgIds = history.map(item => item.id);
        let contextPrompt;
        if (!options.isDM) {
            contextPrompt = this.gpt.getPrompt(this.getFile("./prompts/channel__context__history.txt"), {...options, messages});
        } else {
            contextPrompt = this.gpt.getPrompt(this.getFile("./prompts/DM__context__history.txt"), {...options, messages});
        }
        //this.log({contextPrompt});
        return {contextPrompt, msgIds};
    }

    async getRelevantContext(options, limit, excludeIds) {
        //this.log("getRelevantContext", {options, limit, excludeIds})
        if (["startup", "instruct"].includes(options.type)) {
            return {contextPrompt: '', msgIds: []};
        }
        // Find the most relevant messages accross every channels & DMs
        let history = await this.memory.match(options.prompt, limit);
        //this.log({history});
        // Exclude the ones within `excludeIds`
        if (excludeIds && excludeIds.length > 0) {
            history = history.filter(item => !excludeIds.includes(item.id));
        }
        const msgIds = history.map(item => item.id);
        //this.log({msgIds});
        const messages = history.map(message => {
            return `[${message.metas.channel}][${message.metas.from}] ${message.content}`;
        }).join("\n");
        //this.log({messages});
        const contextPrompt = this.gpt.getPrompt(this.getFile("./prompts/context__relevant.txt"), {...options, messages});
        //this.log({contextPrompt});
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
        this.log("newThinkThread", options)

        // Fetch the context
        const {contextPrompt: historyContext, msgIds: historyContextMsgIds} = await this.getHistoryContext(options, 25);
        const {contextPrompt: relevantContext, msgIds: relevantContextMsgIds} = await this.getRelevantContext(options, 25, historyContextMsgIds);

        this.log({historyContext});
        this.log({relevantContext});

        // Assemble the prompts
        const role_prompt = this.gpt.getPrompt(this.getFile(`./prompts/role.txt`), {
            username: this.metadata.username,
            role: this.metadata.role,
            job_description: this.metadata.job_description,
            responsibilities: '- '+this.metadata.responsibilities.join('\n- '),
            messenger_channels: '- '+this.metadata.messenger_channels.join('\n- '),
            agents: this.project.agents.map(agent => `- ${agent.username} (${agent.role})\n  Job description: ${agent.job_description}`).join('\n')
        });
        const type_prompt = this.gpt.getPrompt(this.getFile(`./prompts/${options.type}.txt`), options);

        const system_prompt = this.gpt.getPrompt(this.getFile("./prompts/system.txt"), {
            project_name: this.project.project.name,
            project_description: this.project.project.description,
            project_specs: this.project.project.specs,
            type_prompt,
            role_prompt,
            historyContext,
            relevantContext
        });

        // Ask GPT
        const response = JSON.parse(await this.gpt.callGPT(system_prompt, options.prompt));
        this.log("GPT Response:", JSON.stringify(response, null, 4))

        // Handle response
        if (!response.actions) {
            this.log("[Nothing more to do, end of loop]")
            return true;
        } else {
            // has actions
            this.log("[Executing actions]")
            const actionResponse = await this.executeActions(response.actions, options.threadId);
            /*return await this.newThinkThread({
                ...options,
                type: 'action_loop',
                prompt: JSON.stringify(actionResponse, null, 4)
            })*/
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
        const { eid, embeddings } = await this.memory.store(message, { from: this.username, to, channel: `DM:${this.username}/${to}`, isDM: true, msgId, threadId });
        await this.history.add(message, { from: this.username, to, channel: `DM:${this.username}/${to}`, isDM: true, eid, msgId, threadId });

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
                        prompt: 'Using the context provided, take the appropriate actions.',
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
            request_reply // Missing???
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
                        prompt: 'Using the context provided, take the appropriate actions.',
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
        const { msgId, threadId, msg, request_reply } = this.parseMessage(message);
        this.log("DM:", { message, from, msgId, threadId, msg, request_reply });
        // Record the message
        const { eid, embeddings } = await this.memory.store(msg, { from, to: this.username, channel: `${this.username}_${from}`, isDM: true, msgId, threadId });
        await this.history.add(msg, { from, to: this.username, channel: `${this.username}_${from}`, isDM: true, eid, msgId, threadId });
        // Need to act on it?
        if (request_reply && from!=this.username) {
            // Action requested
            await this.newThinkThread({
                type: 'DM__reply-requested',
                //prompt: { msgId, threadId, msg, request_reply },
                threadId: msgId,
                prompt: msg,
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
        const { msgId, threadId, msg, request_reply } = this.parseMessage(message);
        this.log("Channel:", { message, from, channel, msgId, threadId, msg, request_reply });
        // Record the message
        const { eid, embeddings } = await this.memory.store(msg, { from, to: this.username, channel, msgId, threadId });
        await this.history.add(msg, { from, to: this.username, channel, isDM: false, eid, msgId, threadId });
        // Need to act on it?
        if (request_reply && request_reply.includes(this.username)) {
            // Action requested
            await this.newThinkThread({
                type: 'channel__reply-requested',
                //prompt: { msgId, threadId, msg, request_reply },
                threadId: msgId,
                prompt: msg,
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

    async instruct(prompt) {
        await this.newThinkThread({
            type: 'instruct',
            prompt: prompt
        })
    }
}

export default Agent;
/*
(async () => {
    const agent = new Agent('../workspaces/europa-discovery', 'PM')
    await agent.init();
})()
*/