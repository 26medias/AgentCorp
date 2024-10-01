import fs from 'fs/promises';
import path from 'path';
import GPTService from './GPTService.js';

class Startup {
    constructor(workspaceDirectory) {
        this.workspaceDirectory = workspaceDirectory;
        this.gptService = new GPTService(process.env.OPENAI_API_KEY);
    }

    // Helper function to create directories
    async createDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            console.error(`Error creating directory: ${dirPath}`, error);
            throw error;
        }
    }

    // Helper function to save a file
    async saveFile(filePath, content) {
        try {
            await fs.writeFile(filePath, content, 'utf8');
        } catch (error) {
            console.error(`Error saving file: ${filePath}`, error);
            throw error;
        }
    }

    // Main function to create a workspace
    async createWorkspace(goal) {
        try {
            // Call GPTService to get the project structure
            const projectData = await this.gptService.ask('prompts/startup.txt', { goal });

            // Define paths
            const projectName = projectData.project.name;
            const projectDir = path.join(this.workspaceDirectory, projectName);
            const agentsDir = path.join(projectDir, 'agents');

            // Create necessary directories
            await this.createDirectory(projectDir);
            await this.createDirectory(agentsDir);

            // Save project.json
            const projectJsonPath = path.join(projectDir, 'project.json');
            await this.saveFile(projectJsonPath, JSON.stringify(projectData, null, 4));

            // Save specs.md
            const specsMdPath = path.join(projectDir, 'specs.md');
            await this.saveFile(specsMdPath, projectData.project.specs);

            // Save messenger.json
            const messengerJsonPath = path.join(projectDir, 'messenger.json');
            await this.saveFile(messengerJsonPath, JSON.stringify(projectData.messenger, null, 4));

            // Save individual agent files
            for (const agent of projectData.agents) {
                const agentFilePath = path.join(agentsDir, `${agent.username}.json`);
                await this.saveFile(agentFilePath, JSON.stringify(agent, null, 4));
            }

            console.log(`Workspace for project "${projectName}" has been successfully created.`);
        } catch (error) {
            console.error('Error creating workspace:', error);
        }
    }
}

export default Startup;
