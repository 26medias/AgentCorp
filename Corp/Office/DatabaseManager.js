// DatabaseManager.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseManager {
    constructor(name, storageDir) {
        if (!name) {
            throw new Error("Name is required for DatabaseManager initialization");
        }
        this.dbDir = path.join(__dirname, 'logs', name);
        this.dbPath = path.join(this.dbDir, 'messages.db');
        this.storageDir = storageDir || path.join(this.dbDir, 'embeddings_storage');
        this.db = null;
        this.openai = null;
        this.init();
    }

    async init() {
        // Ensure the database and storage directories exist
        if (!fs.existsSync(this.dbDir)) {
            fs.mkdirSync(this.dbDir, { recursive: true });
        }

        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Open the SQLite database
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        // Initialize tables and indexes
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY
            );

            CREATE TABLE IF NOT EXISTS channels (
                channelName TEXT PRIMARY KEY
            );

            CREATE TABLE IF NOT EXISTS channel_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                messageId TEXT UNIQUE,
                channelName TEXT,
                fromUser TEXT,
                message TEXT,
                timestamp TEXT,
                embedding TEXT,
                FOREIGN KEY (channelName) REFERENCES channels(channelName)
            );

            CREATE TABLE IF NOT EXISTS direct_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                messageId TEXT UNIQUE,
                fromUser TEXT,
                toUser TEXT,
                message TEXT,
                timestamp TEXT,
                embedding TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_channel_messages_channelName ON channel_messages(channelName);
            CREATE INDEX IF NOT EXISTS idx_direct_messages_fromUser ON direct_messages(fromUser);
            CREATE INDEX IF NOT EXISTS idx_direct_messages_toUser ON direct_messages(toUser);
            CREATE INDEX IF NOT EXISTS idx_channel_messages_messageId ON channel_messages(messageId);
            CREATE INDEX IF NOT EXISTS idx_direct_messages_messageId ON direct_messages(messageId);
        `);
    }

    // UUID Generation Function
    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Add a user
    async addUser(username) {
        await this.db.run(`INSERT OR IGNORE INTO users (username) VALUES (?)`, [username]);
    }

    // Add a channel
    async addChannel(channelName) {
        await this.db.run(`INSERT OR IGNORE INTO channels (channelName) VALUES (?)`, [channelName]);
    }

    // Generate embedding using OpenAI
    async generateEmbedding(text) {
        console.log("[generateEmbedding]", text)
        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: text,
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error("Error generating embedding:", error);
            throw new Error("Embedding generation failed");
        }
    }

    // Log a channel message with embedding
    async logChannelMessage(channelName, fromUser, message, timestamp) {
        const messageId = this.uuid();
        // Generate embedding
        const embeddings = await this.generateEmbedding(message);

        // Serialize embedding as JSON string
        const embeddingStr = JSON.stringify(embeddings);

        await this.db.run(`
            INSERT INTO channel_messages (messageId, channelName, fromUser, message, timestamp, embedding)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [messageId, channelName, fromUser, message, timestamp, embeddingStr]);

        return messageId;
    }

    // Log a direct message with embedding
    async logDirectMessage(fromUser, toUser, message, timestamp) {
        const messageId = this.uuid();
        // Generate embedding
        const embeddings = await this.generateEmbedding(message);

        // Serialize embedding as JSON string
        const embeddingStr = JSON.stringify(embeddings);

        await this.db.run(`
            INSERT INTO direct_messages (messageId, fromUser, toUser, message, timestamp, embedding)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [messageId, fromUser, toUser, message, timestamp, embeddingStr]);

        return messageId;
    }

    // Retrieve embedding for a message
    async getEmbeddings(messageId, type = 'channel') {
        let row;
        if (type === 'channel') {
            row = await this.db.get(`SELECT embedding FROM channel_messages WHERE messageId = ?`, [messageId]);
        } else if (type === 'direct') {
            row = await this.db.get(`SELECT embedding FROM direct_messages WHERE messageId = ?`, [messageId]);
        } else {
            throw new Error("Invalid message type");
        }

        if (row && row.embedding) {
            return JSON.parse(row.embedding);
        }
        return null;
    }

    // Retrieve similar channel messages
    async getSimilarChannelMessages(queryText, channels = [], limit = 5) {
        if (!queryText) {
            throw new Error("Query text is required for similarity search");
        }

        // Generate embedding for the query text
        const queryEmbedding = await this.generateEmbedding(queryText);

        // Prepare SQL query
        let sql = `SELECT messageId, message, fromUser, timestamp, embedding FROM channel_messages`;
        const params = [];

        if (channels.length > 0) {
            const placeholders = channels.map(() => '?').join(', ');
            sql += ` WHERE channelName IN (${placeholders})`;
            params.push(...channels);
        }

        const rows = await this.db.all(sql, params);

        // Compute cosine similarity
        const similarities = rows.map(row => {
            const msgEmbedding = JSON.parse(row.embedding);
            const similarity = this.cosineSimilarity(queryEmbedding, msgEmbedding);
            return { 
                messageId: row.messageId, 
                message: row.message, 
                fromUser: row.fromUser, 
                timestamp: row.timestamp, 
                similarity 
            };
        });

        // Sort by similarity descending
        similarities.sort((a, b) => b.similarity - a.similarity);

        // Return top 'limit' results
        return similarities.slice(0, limit);
    }

    // Retrieve similar direct messages
    async getSimilarDMs(queryText, user, limit = 5) {
        if (!queryText) {
            throw new Error("Query text is required for similarity search");
        }

        if (!user) {
            throw new Error("User is required for similarity search in DMs");
        }

        // Generate embedding for the query text
        const queryEmbedding = await this.generateEmbedding(queryText);

        // Prepare SQL query
        const sql = `
            SELECT messageId, message, fromUser, toUser, timestamp, embedding 
            FROM direct_messages 
            WHERE fromUser = ? OR toUser = ?
        `;
        const params = [user, user];

        const rows = await this.db.all(sql, params);

        // Compute cosine similarity
        const similarities = rows.map(row => {
            const msgEmbedding = JSON.parse(row.embedding);
            const similarity = this.cosineSimilarity(queryEmbedding, msgEmbedding);
            return { 
                messageId: row.messageId, 
                message: row.message, 
                fromUser: row.fromUser, 
                toUser: row.toUser, 
                timestamp: row.timestamp, 
                similarity 
            };
        });

        // Sort by similarity descending
        similarities.sort((a, b) => b.similarity - a.similarity);

        // Return top 'limit' results
        return similarities.slice(0, limit);
    }

    // Cosine similarity calculation
    cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
        if (magnitudeA === 0 || magnitudeB === 0) return 0;
        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * Retrieve channel logs with optional querying, limit, and sorting.
     * 
     * @param {string} channelName - The name of the channel to retrieve logs from.
     * @param {Object} query - Optional query parameters (e.g., timestamp filters).
     * @param {number} limit - The maximum number of messages to retrieve (default: 50).
     * @param {string} sort - The sorting order, either 'ASC' or 'DESC' (default: 'ASC').
     * @returns {Promise<Array>} - A promise that resolves to an array of message objects.
     */
    async getChannelLogs(channelName, query = {}, limit = 50, sort = 'ASC') {
        if (!channelName) {
            throw new Error("Channel name is required");
        }

        try {
            let sql;
            let params = [channelName];

            // Check if sorting is ascending and limit is set
            if (sort.toUpperCase() === 'ASC' && limit) {
                /*
                    To retrieve the last 'limit' messages in ascending order:
                    1. Select the last 'limit' messages ordered by timestamp DESC (most recent first).
                    2. Order the resulting subset by timestamp ASC to get them in chronological order.
                */
                sql = `
                    SELECT * FROM (
                        SELECT * FROM channel_messages 
                        WHERE channelName = ?
                        ${query.timestamp ? `AND timestamp ${query.timestamp.operator} ?` : ''}
                        ORDER BY timestamp DESC 
                        LIMIT ?
                    ) 
                    ORDER BY timestamp ASC
                `;

                // If there's a timestamp filter, add it to params before the limit
                if (query.timestamp) {
                    params.splice(1, 0, query.timestamp.value); // Insert after channelName
                }

                params.push(limit);
            } else {
                /*
                    Default behavior:
                    - Sort based on the 'sort' parameter.
                    - Apply the 'limit' directly.
                */
                sql = `
                    SELECT * FROM channel_messages 
                    WHERE channelName = ?
                    ${query.timestamp ? `AND timestamp ${query.timestamp.operator} ?` : ''}
                    ORDER BY timestamp ${sort.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}
                    ${limit ? 'LIMIT ?' : ''}
                `;

                if (query.timestamp) {
                    params.push(query.timestamp.value);
                }

                if (limit) {
                    params.push(limit);
                }
            }

            // Execute the query
            const rows = await this.db.all(sql, params);
            return rows;
        } catch (error) {
            console.error("Error retrieving channel logs:", error);
            throw error;
        }
    }

    // Retrieve direct message logs with optional querying and sorting
    async getDirectLogs(userA, userB, query = {}, sort = 'ASC') {
        return new Promise(async (resolve, reject) => {
            try {
                let sql = `
                    SELECT * FROM direct_messages 
                    WHERE 
                        (fromUser = ? AND toUser = ?) OR 
                        (fromUser = ? AND toUser = ?)
                `;
                const params = [userA, userB, userB, userA];

                // Simple query support: <, >, ==, != on timestamp
                if (query.timestamp) {
                    const { operator, value } = query.timestamp;
                    if (['<', '>', '=', '!='].includes(operator)) {
                        sql += ` AND timestamp ${operator} ?`;
                        params.push(value);
                    }
                }

                sql += ` ORDER BY timestamp ${sort.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;

                const rows = await this.db.all(sql, params);
                resolve(rows);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Retrieve a specific channel message by messageId
    async getChannelMessageById(messageId) {
        return this.db.get(`SELECT * FROM channel_messages WHERE messageId = ?`, [messageId]);
    }

    // Retrieve a specific direct message by messageId
    async getDirectMessageById(messageId) {
        return this.db.get(`SELECT * FROM direct_messages WHERE messageId = ?`, [messageId]);
    }

    // Close the database connection gracefully
    async close() {
        await this.db.close();
    }
}

export default DatabaseManager;
