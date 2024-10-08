import fs from 'fs/promises';
import path from 'path';
import Agent from '../Agent/Agent.js';
import MessagingServer from './Messenger.js';

class Office {
    constructor(workspaceDirectory) {
        // Ensure that workspaceDirectory is an absolute path
        this.workspaceDirectory = path.resolve(workspaceDirectory);
        this.agents = {};
    }

    async readJson(relativeFilename) {
        const workspaceFilename = path.resolve(this.workspaceDirectory, relativeFilename);
        try {
            const data = await fs.readFile(workspaceFilename, 'utf-8');
            const output = JSON.parse(data);
            return output;
        } catch (error) {
            console.error(`Error reading JSON file at ${workspaceFilename}:`, error);
            throw error; // Re-throw to be caught in init
        }
    }

    async init() {
        console.log("Init");
        const scope = this;
        try {
            this.messenger = new MessagingServer(8080, `${this.workspaceDirectory}/db`, false);
            const projectData = await this.readJson("workspace/project.json");
            console.log(projectData);

            // Initialize all agents in parallel using Promise.allSettled for better error handling
            const initPromises = projectData.agents.map(agentData => {
                console.log(`Creating Agent ${agentData.username}...`);
                const agent = new Agent(this.workspaceDirectory, agentData.username, this.messenger);
                scope.agents[agentData.username] = agent;
                return agent.init();
            });

            const results = await Promise.allSettled(initPromises);

            // Handle initialization results
            results.forEach((result, index) => {
                const agentUsername = projectData.agents[index].username;
                if (result.status === 'rejected') {
                    console.error(`Failed to initialize Agent ${agentUsername}:`, result.reason);
                    // Optionally remove the failed agent or mark it as inactive
                    delete scope.agents[agentUsername];
                }
            });

            // Check if PM agent is available
            if (scope.agents["PM"]) {
                scope.agents["PM"].instruct("Using the project specs, assign the first tasks to your team on the relevant channels. Do not plan to assign tasks, give your team something to do right now.");
            } else {
                console.error('PM agent is not available. Cannot send instructions.');
            }
        } catch (error) {
            console.error('Error creating workspace:', error);
        }
        return true;
    }

    async reset() {
        try {
            // Define paths to delete
            const pathsToDelete = [
                path.resolve(this.workspaceDirectory, 'agents/embeddings'),
                path.resolve(`./logs`)
            ];

            // Delete each directory
            for (const dirPath of pathsToDelete) {
                try {
                    // Check if the directory exists before attempting to delete
                    await fs.access(dirPath);
                    // Remove the directory recursively
                    await fs.rm(dirPath, { recursive: true, force: true });
                    console.log(`Deleted directory: ${dirPath}`);
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        console.warn(`Directory does not exist, skipping deletion: ${dirPath}`);
                    } else {
                        console.error(`Error deleting directory ${dirPath}:`, error);
                        // Decide whether to continue or re-throw the error
                        // For this example, we'll continue deleting other directories
                    }
                }
            }

            console.log('Reset completed successfully.');
        } catch (error) {
            console.error('Error during reset:', error);
            throw error; // Re-throw if you want to handle it upstream
        }
    }
}

export default Office;
