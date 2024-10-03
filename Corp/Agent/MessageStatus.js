class MessageStatus {
    constructor() {
        this.statuses = new Map(); // Store the statuses using a Map for quick access
    }

    // Register a new message status with the name and list of users
    start({ name, from }) {
        if (!name || !Array.isArray(from)) {
            throw new Error("Invalid parameters for start. 'name' must be a string and 'from' must be an array.");
        }

        // Use a Set to track the users who still need to respond
        this.statuses.set(name, new Set(from));
    }

    // Mark a user as done and check if all users are done
    async done(name, user) {
        const status = this.statuses.get(name);

        if (!status) {
            throw new Error(`No status found for name: ${name}`);
        }

        // Remove the user from the Set of users who still need to respond
        status.delete(user);

        // If all users have responded, delete the status and return true
        if (status.size === 0) {
            this.statuses.delete(name);
            return true;
        }

        // Otherwise, return false since there are still users who need to respond
        return false;
    }

    // Check if a status exists
    async has(name) {
        const status = this.statuses.get(name);
        return !!status;
    }
}

export default MessageStatus;

/*
const main = async () => {
    const msgStatus = new MessageStatus();
    msgStatus.start({
        name: "#CodeReview",
        from: ["userA", "userB"]
    });

    // Later...
    let isDone;
    isDone = await msgStatus.done("#CodeReview", "userA"); // isDone = false
    isDone = await msgStatus.done("#CodeReview", "userB"); // isDone = true
}
main();
*/