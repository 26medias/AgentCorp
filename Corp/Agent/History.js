import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class History {
    constructor(directory) {
        this.directory = directory;
        this.indexFilePath = path.join(this.directory, 'index.txt');
    }

    // Initialize the directory and index file if not exists
    async _ensureDirectory() {
        await fs.mkdir(this.directory, { recursive: true });
        try {
            await fs.access(this.indexFilePath);
        } catch {
            await fs.writeFile(this.indexFilePath, '', { flag: 'wx' }); // Create index file if not exists
        }
    }

    // Add a new history entry
    async add(content, metadata = {}) {
        await this._ensureDirectory();
        
        const id = uuidv4();
        const timestamp = new Date().toISOString();

        // Save the content to a separate file (raw text, no JSON)
        const contentFilePath = path.join(this.directory, `${id}.txt`);
        await fs.writeFile(contentFilePath, content);

        // Append metadata to the index file
        const indexEntry = `${id}|${timestamp}|${JSON.stringify(metadata)}\n`;
        await fs.appendFile(this.indexFilePath, indexEntry);
    }

    // Fetch history entries based on metadata filter and optional limit
    async get(filter = {}, limit = null) {
        await this._ensureDirectory();
        const indexEntries = await this._readIndex();
        let matchedEntries = [];

        for (const { id, timestamp, metadata } of indexEntries) {
            if (this.matchesFilter(metadata, filter)) {
                matchedEntries.push({ id, timestamp, metadata });
            }
        }

        // Sort by timestamp (ascending)
        matchedEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Apply limit if provided
        if (limit) {
            matchedEntries = matchedEntries.slice(-limit);
        }

        // Fetch the content for matched entries
        const results = [];
        for (const entry of matchedEntries) {
            const contentFilePath = path.join(this.directory, `${entry.id}.txt`);
            const content = await fs.readFile(contentFilePath, 'utf-8');
            results.push({ ...entry, content });
        }

        return results;
    }

    // Helper to read and parse the index file
    async _readIndex() {
        const indexData = await fs.readFile(this.indexFilePath, 'utf-8');
        const lines = indexData.split('\n').filter(Boolean); // Remove empty lines
        return lines.map(line => {
            const [id, timestamp, metadataStr] = line.split('|');
            return {
                id,
                timestamp,
                metadata: JSON.parse(metadataStr)
            };
        });
    }

    // Helper to check if an entry matches the filter
    matchesFilter(metadata, filter) {
        return Object.keys(filter).every(key => metadata[key] === filter[key]);
    }
}

export default History;

/*
const history = new History('./history_directory');
await history.add("content", {from: "username", channel: "some_channel"});
await history.add("other content", {from: "other_user", channel: "other_channel"});

const allResults = await history.get();
const fromUsername = await history.get({from: "username"});
const last5Channel = await history.get({channel: "some_channel"}, 5);
*/