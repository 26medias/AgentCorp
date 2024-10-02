# History Class Documentation

The `History` class provides a way to store and retrieve messages with metadata and timestamps. Each message is saved in a content file, while the metadata is appended to an index file for efficient search and retrieval.

## Constructor

### `new History(directory)`

Creates a new instance of the `History` class.

- `directory`: The path to the directory where history files will be stored.

## Methods

### `async add(content, metadata = {})`

Adds a new history entry.

- `content`: The message content to be stored.
- `metadata`: Optional object containing metadata (e.g., `{from: "username", channel: "some_channel"}`).

#### Example:
	new History('./history_directory')
	await history.add("Hello, World!", {from: "John", channel: "general"})

### `async get(filter = {}, limit = null)`

Retrieves history entries, optionally filtered by metadata and/or limited to a certain number of recent entries. Results are sorted by timestamp in ascending order.

- `filter`: An object containing metadata keys to filter the results (e.g., `{from: "John"}`).
- `limit`: Optional number to limit the results to the last `limit` entries.

#### Example:
	// Retrieve all entries
	const allResults = await history.get()

	// Retrieve all entries from a specific user
	const fromUsername = await history.get({from: "John"})

	// Retrieve the last 5 entries from a specific channel
	const last5Channel = await history.get({channel: "general"}, 5)

## Internal Methods

### `_ensureDirectory()`

Ensures the directory and index file exist. If not, they are created.

### `_readIndex()`

Reads and parses the index file, returning an array of entries with their `id`, `timestamp`, and `metadata`.

### `matchesFilter(metadata, filter)`

Helper function to determine if a history entry's metadata matches the provided filter criteria.

## Files Structure

Each history entry is saved as two files:

1. **Index file** (`index.txt`): Each line contains the `id`, `timestamp`, and `metadata` of the entry.
2. **Content file** (`{id}.txt`): A file named after the unique `id`, containing the message content.

#### Example:
	./history_directory/
		index.txt              // Metadata for all entries
		1234-5678-9012.txt     // Content for entry with id 1234-5678-9012
		5678-9012-3456.txt     // Content for entry with id 5678-9012-3456

