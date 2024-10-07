
import Office from './Office.js';


(async () => {
    const project = "jupiter-ruins";
    const office = new Office(`../workspaces/${project}`);
    await office.reset();
    await office.init();
})();
