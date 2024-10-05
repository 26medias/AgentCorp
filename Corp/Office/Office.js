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
        console.log("Init")
        const scope = this;
        try {
            const projectData = await this.readJson("workspace/project.json");
            console.log(projectData);

            let i;
            for (i in projectData.agents) {
                console.log(`Creating Agent ${projectData.agents[i].username}...`)
                scope.agents[projectData.agents[i].username] = new Agent(this.workspaceDirectory, projectData.agents[i].username);
                await scope.agents[projectData.agents[i].username].init();
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
