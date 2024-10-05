import fs from 'fs/promises';
import path from 'path';
import Agent from '../Agent/Agent.js';

class Office {
    constructor(workspaceDirectory) {
        this.workspaceDirectory = workspaceDirectory;
        this.agents = {};
    }

    async readJson(filename) {
        const workspace_filename = `${this.workspaceDirectory}/${filename}`;
        const data = await fs.readFile(workspace_filename, 'utf-8');
        const output = JSON.parse(data);
        return output
    }

    async init() {
        console.log("Init");
        const scope = this;
        try {
            const projectData = await this.readJson("workspace/project.json");
            console.log(projectData);
    
            // Initialize all agents in parallel
            const initPromises = projectData.agents.map(agentData => {
                console.log(`Creating Agent ${agentData.username}...`);
                const agent = new Agent(this.workspaceDirectory, agentData.username);
                scope.agents[agentData.username] = agent;
                return agent.init()
                    .then(() => ({ status: 'fulfilled', agent: agentData.username }))
                    .catch(error => ({ status: 'rejected', agent: agentData.username, reason: error }));
            });
    
            const results = await Promise.all(initPromises);
    
            // Handle initialization results
            results.forEach(result => {
                if (result.status === 'rejected') {
                    console.error(`Failed to initialize Agent ${result.agent}:`, result.reason);
                    // Optionally remove the failed agent or mark it as inactive
                    delete scope.agents[result.agent];
                }
            });
    
            // Check if PM agent is available
            if (scope.agents["PM"]) {
                scope.agents["PM"].instruct("Let's start this project! Where do we start? Assign the first tasks.");
            } else {
                console.error('PM agent is not available. Cannot send instructions.');
            }
        } catch (error) {
            console.error('Error creating workspace:', error);
        }
        return true;
    }
    
}

export default Office;

(async () => {
    const office = new Office('../workspaces/jupiter-ruins')
    await office.init();
})()
