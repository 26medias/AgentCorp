import fs from 'fs';
import MessengerClient from './MessengerClient.js';
import Embeddings from './Embeddings.js'
import GPTService from './GPTService.js';
import History from './History.js';

class Agent {
    constructor(workspace_directory, username) {
        this.workspace_directory = workspace_directory;
        this.username = username;
    }

    async init() {
        this.metadata = JSON.parse(fs.readFileSync(`${this.workspace_directory}/agents/${this.username}.json`, 'utf8'));
        this.project = JSON.parse(fs.readFileSync(`${this.workspace_directory}/project.json`, 'utf8'));
        this.memory = new Embeddings(`${this.workspace_directory}/agents/embeddings/${this.username}`);
        this.history = new History(`${this.workspace_directory}/agents/${this.username}`);
        this.gpt = new GPTService(process.env.OPENAI_API_KEY);
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

    async onDM(message, from) {
        console.log("DM:", { message, from });
        const { id, embeddings } = await this.memory.store(message, { from, isDM: true });
        await this.history.add(message, { from, isDM: true, id });
    }

    async onMessage(message, from, channel) {
        console.log("Channel:", { message, from, channel });
        const { id, embeddings } = await this.memory.store(message, { from, channel });
        await this.history.add(message, { from, channel, isDM: false, id });
    }
}

(async () => {
    const agent = new Agent('../workspaces/europa-discovery', 'PM')
    await agent.init();
})()
