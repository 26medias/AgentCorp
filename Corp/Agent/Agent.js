// Agent.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MessengerClient from './MessengerClient.js';
import GPTService from './GPTService.js';
import WorkspaceOp from './WorkspaceOp.js';

class Agent {
    constructor(workspace_directory, username, messenger) {
        this.workspace_directory = workspace_directory;
        this.username = username;
        this.messenger = messenger;

        // Initialize GPTService and WorkspaceOp
        this.gpt = new GPTService(process.env.OPENAI_API_KEY); // GPT wrapper
        this.ops = new WorkspaceOp(`${this.workspace_directory}/workspace`);
    }

    // UUID Generation Function
    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Helper method to get absolute file paths
    getFile(relativePath) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        return path.resolve(__dirname, relativePath);
    }

    // Logging utility
    log(...args) {
        console.log(`[${this.username}]`, ...args);
    }

    // Initialize the Agent
    async init() {
        try {
            // Load metadata and project configurations
            this.metadata = JSON.parse(fs.readFileSync(`${this.workspace_directory}/agents/${this.username}.json`, 'utf8'));
            this.project = JSON.parse(fs.readFileSync(`${this.workspace_directory}/workspace/project.json`, 'utf8'));

            // Connect to the Messenger Server
            await this.connectToMessenger();
        } catch (error) {
            this.log('Initialization Error:', error);
            throw error; // Re-throw to handle upstream if necessary
        }
    }

    // Connect to the Messenger Server and set up event listeners
    async connectToMessenger(messenger_server = 'ws://localhost:8080') {
        const scope = this;
        this.client = new MessengerClient(messenger_server, this.username);
        this.client.connect(this.project.project.name);

        // Event: Receive a message in a channel
        this.client.on('channelMessage', (message, from, channel) => {
            scope.onMessage(message, from, channel);
        });

        // Event: Your turn to send a message
        this.client.on('your_turn', () => {
            scope.onTurn();
        });

        // Event: Connection closed
        this.client.on('close', () => {
            scope.log('Connection closed');
            // TODO: Implement reconnection logic if necessary
        });

        // Await connection establishment
        return new Promise((resolve, reject) => {
            scope.client.on('open', () => {
                // Join all channels specified in metadata
                for (let i in scope.metadata.messenger_channels) {
                    scope.client.joinChannel(scope.metadata.messenger_channels[i]);
                    this.log(`JOINED ${scope.metadata.messenger_channels[i]}`);
                }
                resolve(true);
            });
            scope.client.on('error', (err) => {
                this.log('Messenger Client Error:', err);
                reject(err);
            });
        });
    }

    // Parse incoming messages safely
    parseMessage(message) {
        try {
            const msg = JSON.parse(message);
            return msg;
        } catch (error) {
            this.log('Message Parsing Error:', error);
            return null;
        }
    }

    // Determine whether to act on a received message
    async shouldActOnMessage(message, from, channel) {
        // Implement your custom logic here
        // Example: Act only if the message mentions the agent's username
        if (message.includes(`@${this.username}`)) {
            return true;
        } else {
            // Fetch history context
            const historyContextData = await this.getHistoryContext({
                channel: channel,
                type: 'should_act'
            }, 25);

            // Fetch relevant context, excluding historyContext message IDs
            const relevantContextData = await this.getRelevantContext({
                prompt: message,
                type: 'should_act'
            }, 25, historyContextData.msgIds);

            // Assemble the prompts
            const role_prompt = this.gpt.getPrompt(this.getFile("./prompts/role.txt"), {
                username: this.metadata.username,
                role: this.metadata.role,
                job_description: this.metadata.job_description,
                responsibilities: '- ' + this.metadata.responsibilities.join('\n- '),
                messenger_channels: '- ' + this.metadata.messenger_channels.join('\n- '),
                agents: this.project.agents.map(agent => `- ${agent.username} (${agent.role})\n  Job description: ${agent.job_description}`).join('\n')
            });

            const should_act_prompt = this.gpt.getPrompt(this.getFile("./prompts/should_act.txt"), {
                project_name: this.project.project.name,
                project_description: this.project.project.description,
                project_specs: this.project.project.specs,
                from,
                channel,
                role_prompt,
                historyContext: historyContextData.contextPrompt,
                relevantContext: relevantContextData.contextPrompt
            });

            const gptResponse = await this.gpt.callGPT(should_act_prompt, `[Channel:${channel}][From:${from}] ${message}`);
            const response = JSON.parse(gptResponse);
            this.log("shouldActOnMessage Response:", JSON.stringify(response, null, 4));
            if (response.require_actions) {
                this.log("shouldActOnMessage [Requires actions]", response.reason);
                return true;
            } else {
                this.log("shouldActOnMessage [No actions]");
            }
        }
        return false;
    }

    // Handle incoming channel messages
    async onMessage(message, from, channel) {
        const parsedMessage = this.parseMessage(message);
        if (!parsedMessage) return; // Invalid message format

        const { msgId, msg } = parsedMessage;
        this.log("Channel Message Received:", { message, from, channel, msgId, msg });

        // Determine if the agent should act on this message
        const shouldAct = await this.shouldActOnMessage(msg, from, channel);
        if (shouldAct) {
            // Raise hand to request a turn
            this.client.raiseHand();
            this.log(`Raised hand to act on message from ${from} in channel ${channel}`);
        }
    }

    // Handle the event when it's the agent's turn to act
    async onTurn() {
        this.log('Received your_turn event. Initiating action thread.');
        
        await this.newThinkThread({
            type: 'act',
            prompt: false
        });
    }

    // Execute actions as instructed by GPT
    async executeActions(actions) {
        let output = [];
        for (let action of actions) {
            try {
                switch (action.action) {
                    case "glob":
                        {
                            const readBuffer = {};
                            for (let filename of action.data) {
                                const response = await this.ops.glob(filename);
                                readBuffer[filename] = JSON.stringify(response);
                            }
                            output.push({
                                action: action.action,
                                output: readBuffer
                            });
                        }
                        break;
                    case "readFiles":
                        {
                            const readBuffer = {};
                            for (let filename of action.data) {
                                const response = await this.ops.readFile(filename);
                                readBuffer[filename] = response;
                            }
                            output.push({
                                action: action.action,
                                output: readBuffer
                            });
                        }
                        break;
                    case "writeFiles":
                        {
                            const writeBuffer = {};
                            for (let item of action.data) {
                                const response = await this.ops.writeFile(item.filename, item.content);
                                writeBuffer[item.filename] = response;
                            }
                            output.push({
                                action: action.action,
                                output: writeBuffer
                            });
                        }
                        break;
                    case "runShellCommand":
                        {
                            const response = await this.ops.runShellCommand(action.data.command);
                            output.push({
                                action: action.action,
                                output: response
                            });
                        }
                        break;
                    case "sendChannelMessages":
                        {
                            for (let item of action.data) {
                                await this.sendChannelMessage(item.channel, item.message);
                            }
                            output.push({
                                action: action.action,
                                output: true
                            });
                        }
                        break;
                    default:
                        output.push({
                            action: action.action,
                            output: "Unknown action"
                        });
                        break;
                }
            } catch (error) {
                this.log(`Error executing action ${action.action}:`, error);
                output.push({
                    action: action.action,
                    output: `Error: ${error.message}`
                });
            }
        }
        return output;
    }

    // Send a message to a channel
    async sendChannelMessage(channel, message) {
        const msgId = this.uuid();
        try {
            // Send the message via MessengerClient
            this.client.send(channel, message);

            this.log(`[>${channel}] ${message}`);
        } catch (error) {
            this.log('Error sending channel message:', error);
        }
    }

    // Handle instructions to the Agent
    async instruct(prompt) {
        await this.newThinkThread({
            type: 'instruct',
            prompt: prompt
        });
    }

    // Assemble and process a new thinking thread
    async newThinkThread(options) {
        options = {
            type: 'startup', // Default type
            prompt: null,
            threadId: null, // No longer used
            from: null,
            channel: null,
            isDM: false,
            ...options
        };
        this.log("Initiating newThinkThread with options:", options);

        try {
            // Fetch history context
            const historyContextData = await this.getHistoryContext({
                channel: options.channel,
                type: options.type
            }, 25);

            if (!options.prompt) {
                options.prompt = JSON.stringify(historyContextData.logs[historyContextData.logs.length-1]);
            }

            // Fetch relevant context, excluding historyContext message IDs
            const relevantContextData = await this.getRelevantContext({
                prompt: options.prompt,
                type: options.type
            }, 25, historyContextData.msgIds);

            this.log({ historyContext: historyContextData.contextPrompt, relevantContext: relevantContextData.contextPrompt });

            // Assemble the prompts
            const role_prompt = this.gpt.getPrompt(this.getFile("./prompts/role.txt"), {
                username: this.metadata.username,
                role: this.metadata.role,
                job_description: this.metadata.job_description,
                responsibilities: '- ' + this.metadata.responsibilities.join('\n- '),
                messenger_channels: '- ' + this.metadata.messenger_channels.join('\n- '),
                agents: this.project.agents.map(agent => `- ${agent.username} (${agent.role})\n  Job description: ${agent.job_description}`).join('\n')
            });

            const type_prompt = this.gpt.getPrompt(this.getFile(`./prompts/${options.type}.txt`), options);

            const system_prompt = this.gpt.getPrompt(this.getFile("./prompts/system.txt"), {
                project_name: this.project.project.name,
                project_description: this.project.project.description,
                project_specs: this.project.project.specs,
                type_prompt,
                role_prompt,
                historyContext: historyContextData.contextPrompt,
                relevantContext: relevantContextData.contextPrompt
            });

            // Call GPT with the assembled prompts
            const gptResponse = await this.gpt.callGPT(system_prompt, options.prompt);
            const response = JSON.parse(gptResponse);
            this.log("GPT Response:", JSON.stringify(response, null, 4));

            // Handle response actions
            if (!response.actions || response.actions.length === 0) {
                this.log("[No actions to execute]");
                return true;
            } else {
                this.log("[Executing actions]");
                const actionResponse = await this.executeActions(response.actions);
                return actionResponse;
            }
        } catch (error) {
            this.log('Error in newThinkThread:', error);
            return false;
        }
    }

    /**
     * Retrieves the historical context for a channel using a prompt template.
     * @param {Object} options - Configuration options.
     * @param {number} limit - The maximum number of messages to retrieve.
     * @returns {Object} - Contains the context prompt and message IDs.
     */
    async getHistoryContext(options, limit) {
        // Do not fetch history for specific types
        if (!options.channel || ["startup", "instruct"].includes(options.type)) {
            return { contextPrompt: '', msgIds: [] };
        }

        try {
            // Fetch channel logs from DatabaseManager
            const logs = await this.messenger.dbManager.getChannelLogs(options.channel, {}, limit);

            const messages = logs.map(message => {
                return `[${message.fromUser}] ${message.message}`;
            }).join('\n');

            const msgIds = logs.map(item => item.messageId);

            // Load and populate the history prompt template
            const contextPrompt = this.gpt.getPrompt(this.getFile("./prompts/context__history.txt"), {
                messages
            });

            return { contextPrompt, msgIds };
        } catch (error) {
            this.log('Error fetching history context:', error);
            return { contextPrompt: '', msgIds: [], logs };
        }
    }

    /**
     * Retrieves the most relevant context for a channel using a prompt template,
     * excluding messages already included in the history context.
     * @param {Object} options - Configuration options.
     * @param {number} limit - The maximum number of messages to retrieve.
     * @param {Array} excludeIds - Array of message IDs to exclude.
     * @returns {Object} - Contains the context prompt and message IDs.
     */
    async getRelevantContext(options, limit, excludeIds) {
        // Do not fetch relevant context for specific types
        if (!options.prompt || ["startup", "instruct"].includes(options.type)) {
            return { contextPrompt: '', msgIds: [] };
        }

        try {
            // Fetch similar messages from DatabaseManager
            let similarMessages = await this.messenger.dbManager.getSimilarChannelMessages(options.prompt, this.metadata.messenger_channels, limit);

            // Exclude messages that are already in historyContext
            if (excludeIds && excludeIds.length > 0) {
                similarMessages = similarMessages.filter(msg => !excludeIds.includes(msg.messageId));
            }

            const messages = similarMessages.map(message => {
                return `[${message.fromUser}] ${message.message}`;
            }).join('\n');

            const msgIds = similarMessages.map(item => item.messageId);

            // Load and populate the relevant context prompt template
            const contextPrompt = this.gpt.getPrompt(this.getFile("./prompts/context__relevant.txt"), {
                messages
            });

            return { contextPrompt, msgIds };
        } catch (error) {
            this.log('Error fetching relevant context:', error);
            return { contextPrompt: '', msgIds: [] };
        }
    }
}

export default Agent;
