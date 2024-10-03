# Tree Class Documentation

The `Tree` class manages dependencies between branches and tracks when each branch can be completed based on its sub-branches. A branch can only be marked as completed if all its sub-branches are also completed. Each branch has an associated callback that is executed once the branch is completed.

## Constructor

### `new Tree()`

Creates a new instance of the `Tree` class.

## Methods

### `branch(name, parent, callback)`

Registers a new branch with a specified `name`, an optional `parent` branch, and a `callback` to be executed when the branch is marked as completed.

- `name`: A unique string identifier for the branch.
- `parent`: The name of the parent branch (optional).
- `callback`: A function to be executed when the branch is completed.

#### Example:
	const tree = new Tree();
	tree.branch("root", null, (payload) => {
		// Root completed
	});
	tree.branch("branch1", "root", (payload) => {
		// branch1 completed
	});

### `getParent(branchName)`

Retrieves the parent of the specified branch.

- `branchName`: The name of the branch for which to retrieve the parent.

Returns:
- The name of the parent branch or `null` if the branch has no parent.

#### Example:
	const parent = tree.getParent("branch1"); // "root"

### `done(name, payload = {})`

Marks the specified branch as completed. If all its sub-branches are also completed, the branch's callback is executed with the optional `payload`. Returns `true` if the branch is successfully marked as done, or `false` if it has incomplete dependencies.

- `name`: The name of the branch to mark as completed.
- `payload`: An optional object to pass to the branch's callback when completed.

Returns:
- `true` if the branch was completed successfully.
- `false` if the branch has incomplete sub-branches.

#### Example:
	let isDone = tree.done("branch1.1"); // true, if branch1.1 has no incomplete sub-branches

### `areBranchesCompleted(name)`

Checks if all the sub-branches of the specified branch have been completed.

- `name`: The name of the branch to check for completion.

Returns:
- `true` if all the sub-branches of the branch are completed.
- `false` if any sub-branches are incomplete.

#### Example:
	const isCompleted = tree.areBranchesCompleted("root"); // true or false

## Internal Data Structure

- The class uses a `Map` to store each branch with its parent, callback, and children.
- A `Set` is used to store the names of completed branches for quick lookup.

### Usage Flow

1. Use `branch(name, parent, callback)` to register branches.
2. Call `done(name, payload)` to mark a branch as completed once all its sub-branches are done.
3. Use `areBranchesCompleted(name)` to check if a branch’s dependencies are fully resolved before attempting to mark it as done.
