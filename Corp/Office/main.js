
import Office from './Office.js';
//import Agent from '../Agent/Agent.js';

(async () => {
    const project = "moon-lava-structure";
    const office = new Office(`../workspaces/${project}`);
    await office.reset();
    await office.init();
})();

/*
// Test
(async () => {
    const project = "moon-lava-structure";
    const workspaceDirectory = `../workspaces/${project}`;
    const agent_A = new Agent(workspaceDirectory, {
        "name": "agent_A",
        "description": "You are a sci-fi writer.",
        "behavior": ""
    });
    const agent_B = new Agent(workspaceDirectory, {
        "name": "agent_B",
        "description": "You are a sci-fi writer.",
        "behavior": ""
    });
    const agent_R = new Agent(workspaceDirectory, {
        "name": "agent_R",
        "description": ""
    });

    const workspace = new Workspace();
    workspace.add(agent_A);
    workspace.add(agent_B);
    workspace.add(agent_R);
})();

class AgentTest extends Agent {

}*/