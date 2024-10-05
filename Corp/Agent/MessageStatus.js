class MessageStatus {
    constructor() {
        // Store the statuses using a Map for quick access
        // Each entry will map a status name to an object containing:
        // - users: Set of users who need to respond
        // - onComplete: Optional callback to execute when all users are done
        this.statuses = new Map();
    }

    /**
     * Register a new message status with the name, list of users, and an optional onComplete callback.
     * @param {Object} params
     * @param {string} params.name - The name of the status.
     * @param {Array<string>} params.from - The list of users associated with the status.
     * @param {Function} [params.onComplete] - Optional callback to execute when all users are done.
     */
    start({ name, from, onComplete }) {
        if (!name || !Array.isArray(from)) {
            throw new Error("Invalid parameters for start. 'name' must be a string and 'from' must be an array.");
        }

        if (this.statuses.has(name)) {
            throw new Error(`Status with name "${name}" already exists.`);
        }

        // Use a Set to track the users who still need to respond
        this.statuses.set(name, {
            users: new Set(from),
            onComplete: typeof onComplete === 'function' ? onComplete : null
        });
    }

    /**
     * Mark a user as done and check if all users are done.
     * If all users are done, execute the onComplete callback if it exists.
     * @param {string} name - The name of the status.
     * @param {string} user - The user who has completed.
     * @returns {Promise<boolean>} - Returns true if all users are done, otherwise false.
     */
    async done(name, user) {
        const status = this.statuses.get(name);

        if (!status) {
            return null;
        }

        // Remove the user from the Set of users who still need to respond
        status.users.delete(user);

        // If all users have responded
        if (status.users.size === 0) {
            this.statuses.delete(name);

            // Execute the onComplete callback if it exists
            if (status.onComplete) {
                try {
                    // Await in case the callback is asynchronous
                    await status.onComplete();
                } catch (error) {
                    console.error(`Error in onComplete callback for status "${name}":`, error);
                }
            }

            return true;
        }

        // Otherwise, return false since there are still users who need to respond
        return false;
    }

    /**
     * Check if a status exists.
     * @param {string} name - The name of the status.
     * @returns {Promise<boolean>} - Returns true if the status exists, otherwise false.
     */
    async has(name) {
        return this.statuses.has(name);
    }
}

export default MessageStatus;

/*
// Example Usage 
const main = async () => {
    const msgStatus = new MessageStatus();

    // Start a status without onComplete
    msgStatus.start({
        name: "#CodeReview",
        from: ["userA", "userB"]
    });

    // Later...
    let isDone;
    isDone = await msgStatus.done("#CodeReview", "userA"); // isDone = false
    console.log(`#CodeReview done after userA: ${isDone}`); // Output: false
    isDone = await msgStatus.done("#CodeReview", "userB"); // isDone = true
    console.log(`#CodeReview done after userB: ${isDone}`); // Output: true

    // Start a status with onComplete callback
    msgStatus.start({
        name: "#test",
        from: ["userA", "userB"],
        onComplete: () => {
            console.log("done!");
        }
    });

    // Later...
    isDone = await msgStatus.done("#test", "userA"); // isDone = false
    console.log(`#test done after userA: ${isDone}`); // Output: false
    isDone = await msgStatus.done("#test", "userB"); // isDone = true, onComplete executes
    console.log(`#test done after userB: ${isDone}`); // Output: true
    // "done!" is printed to the console
};

main();
*/