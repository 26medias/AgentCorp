
import Office from './Office.js';


(async () => {
    const project = "moon-lava-structure";
    const office = new Office(`../workspaces/${project}`);
    await office.reset();
    await office.init();
})();
