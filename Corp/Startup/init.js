import Startup from './Startup.js';

const startup = new Startup("../workspaces");

(async () => {
    try {
        //await startup.createWorkspace("Write a 10000 words hard sci-fi short story about the discovery of a conscious alien creature on the Europa in the year 2124Discover an alien civilization on Europa");
        //await startup.createWorkspace("Generate a detailed business plan for a Breakfast restaurant in Aurora, Ontario");
        //await startup.createWorkspace("Write a 10000 words hard sci-fi short story about the discovery of alien ruins on one of Jupiter's moon");
        await startup.createWorkspace("Write a 10000 words hard sci-fi/horror short story about the discovery of an unknown alien structure deep within a lava cave on the moon during the construction of the first permanent international research base.");
    } catch (error) {
        console.error("Error:", error);
    }
})();