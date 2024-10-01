import Startup from './Startup.js';

const startup = new Startup("../workspaces");

(async () => {
    try {
        //await startup.createWorkspace("Write a 10000 words hard sci-fi short story about the discovery of a conscious alien creature on the Europa in the year 2124Discover an alien civilization on Europa");
        await startup.createWorkspace("Generate a detailed business plan for a Breakfast restaurant in Aurora, Ontario");
    } catch (error) {
        console.error("Error:", error);
    }
})();