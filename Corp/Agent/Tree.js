class Tree {
    constructor() {
        this.branches = new Map(); // Store branches with their data
        this.completed = new Set(); // Store completed branches
    }

    // Register a new branch
    branch(name, parent, callback) {
        if (!name || typeof callback !== 'function') {
            throw new Error("Invalid parameters for branch. 'name' must be a string and 'callback' must be a function.");
        }

        this.branches.set(name, {
            parent: parent || null,
            callback: callback,
            children: new Set()
        });

        if (parent && this.branches.has(parent)) {
            this.branches.get(parent).children.add(name);
        }
    }

    // Get the parent of a branch
    getParent(branchName) {
        const branch = this.branches.get(branchName);
        if (!branch) {
            throw new Error(`Branch "${branchName}" does not exist.`);
        }
        return branch.parent;
    }

    // Mark a branch as completed
    done(name, payload = {}) {
        const branch = this.branches.get(name);

        if (!branch) {
            throw new Error(`Branch "${name}" does not exist.`);
        }

        // Check if all children are completed
        if (!this.areBranchesCompleted(name)) {
            return false;
        }

        // Mark the branch as completed and execute its callback
        this.completed.add(name);
        branch.callback(payload);
        return true;
    }

    // Check if all child branches are completed
    areBranchesCompleted(name) {
        const branch = this.branches.get(name);
        if (!branch) {
            throw new Error(`Branch "${name}" does not exist.`);
        }

        // If it has no children, it's automatically completed
        if (branch.children.size === 0) {
            return true;
        }

        // Check if all children are completed
        for (const child of branch.children) {
            if (!this.completed.has(child)) {
                return false;
            }
        }

        return true;
    }
}

export default Tree;

/*
const tree = new Tree();
tree.branch("root", null, (payload) => {
    console.log("Root completed", payload);
});
tree.branch("branch1", "root", (payload) => {
    console.log("branch1 completed", payload);
});
tree.branch("branch1.1", "branch1", (payload) => {
    console.log("branch1.1 completed", payload);
});
tree.branch("branch2", "root", (payload) => {
    console.log("branch2 completed", payload);
});

const branch1Parent = tree.getParent("branch1"); // "root"
tree.done("branch1.1"); // branch1.1 completed
const isBranch2Completed = tree.areBranchesCompleted("branch2"); // true
tree.done("branch2"); // branch2 completed
const isRootCompleted = tree.areBranchesCompleted("root"); // false
tree.done("branch1"); // branch1 completed
const isRootCompleted2 = tree.areBranchesCompleted("root"); // true
tree.done("root", {"hello": "world"}); // Root completed with payload {"hello": "world"}
*/