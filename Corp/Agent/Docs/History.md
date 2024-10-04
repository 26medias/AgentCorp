# History Class Documentation

The `History` class provides functionality for storing and retrieving history entries, including metadata and timestamps. Each entry is saved as a content file, while metadata is appended to an index file for efficient searching.

## Constructor

### `new History(directory)`

Creates a new instance of the `History` class.

- `directory`: The path to the directory where history files will be stored.

## Methods

### `add(content, metadata = {})`

Adds a new entry to the history.

- `content`: The message or content to be stored.
- `metadata`: An optional object containing metadata (e.g., `{from: "username", channel: "some_channel"}`).

#### Example:
	const history = new History('./history_directory');
	await history.add("Hello, World!", { from: "userA", channel: "general" });

### `get(filter = {}, limit = null)`

Retrieves history entries based on an optional metadata filter and an optional limit for the number of results. The results are sorted by timestamp in ascending order.

- `filter`: An object containing metadata keys to filter the results (e.g., `{ from: "userA" }`).
- `limit`: Optional number of entries to retrieve, returning the last `limit` results.

#### Example:
	const allResults = await history.get(); // Retrieves all entries
	const fromUsername = await history.get({ from: "userA" }); // Retrieves entries from user "userA"
	const last5Channel = await history.get({ channel: "general" }, 5); // Retrieves the last 5 entries from the "general" channel

### Internal Methods

### `_ensureDirectory()`

Ensures that the storage directory and index file exist. If they do not, they will be created.

### `_readIndex()`

Reads and parses the index file to return an array of entries with `id`, `timestamp`, and `metadata`.

### `matchesFilter(metadata, filter)`

Helper function to determine if a history entry's metadata matches the provided filter criteria.

## Files Structure

- **Index file (`index.txt`)**: Each line in the index file contains the unique ID, timestamp, and metadata for each history entry.
- **Content files (`{id}.txt`)**: The content of each history entry is saved in separate files named after their unique ID.

#### Example:
	./history_directory/
		index.txt               // Metadata for all entries
		123e4567-e89b.txt       // Content for entry with ID 123e4567-e89b
		456a7890-d12c.txt       // Content for entry with ID 456a7890-d12c

## Response Examples

#### Adding History Entries:
	await history.add("Message 1", { from: "userA", channel: "general" });
	await history.add("Message 2", { from: "userB", channel: "random" });

#### Retrieving All Entries:
	const allResults = await history.get();
	// [
	//     { id: "123e4567-e89b", timestamp: "2023-06-01T12:00:00Z", metadata: { from: "userA", channel: "general" }, content: "Message 1" },
	//     { id: "456a7890-d12c", timestamp: "2023-06-01T13:00:00Z", metadata: { from: "userB", channel: "random" }, content: "Message 2" }
	// ]

#### Retrieving Entries by Filter:
	const fromUserA = await history.get({ from: "userA" });
	// [
	//     { id: "123e4567-e89b", timestamp: "2023-06-01T12:00:00Z", metadata: { from: "userA", channel: "general" }, content: "Message 1" }
	// ]

#### Retrieving the Last 5 Entries from a Channel:
	const last5FromGeneral = await history.get({ channel: "general" }, 5);
	// [
	//     { id: "789f1234-g56h", timestamp: "2023-06-02T14:00:00Z", metadata: { from: "userA", channel: "general" }, content: "Message 3" },
	//     ...
	// ]
