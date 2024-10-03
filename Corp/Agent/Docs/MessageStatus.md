# MessageStatus Class Documentation

The `MessageStatus` class is designed to track the status of a message when multiple users are required to respond before an action can be taken. The class allows registering a new status with a message name and a list of users, and it tracks which users have responded.

## Constructor

### `new MessageStatus()`

Creates a new instance of the `MessageStatus` class.

## Methods

### `start({ name, from })`

Registers a new status for tracking. This method initializes the message state by recording the `name` of the message and the list of users expected to respond.

- `name`: A unique string identifier for the message.
- `from`: An array of users who are expected to respond.

#### Example:
	const msgStatus = new MessageStatus();
	msgStatus.start({
	    name: "#CodeReview",
	    from: ["userA", "userB"]
	});

### `async done(name, user)`

Marks a user as having responded. Once all users have responded, the status is cleared from memory, and `true` is returned. If more responses are still required, the method returns `false`.

- `name`: The name of the message whose status is being tracked.
- `user`: The user who has responded.

Returns:
- `true`: If all users have responded.
- `false`: If there are still more users who need to respond.

#### Example:
	let isDone;
	isDone = await msgStatus.done("#CodeReview", "userA"); // isDone = false
	isDone = await msgStatus.done("#CodeReview", "userB"); // isDone = true

### Internal Memory Management

Once all users have responded to a particular message, the internal memory tracking that message's status is automatically deleted to free up space and prevent redundant tracking.

## Usage Workflow

1. Use the `start()` method to register a new status with a unique name and a list of users.
2. Track responses by calling `done(name, user)` for each user as they respond.
3. Once the final user responds, the status will be automatically deleted from the internal memory.

## Data Structure

- Internally, the class uses a `Map` to store statuses. The `name` serves as the key, and a `Set` is used to store the users who still need to respond.

