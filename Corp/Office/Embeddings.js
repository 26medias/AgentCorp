import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

class Embeddings {
    constructor(storageDir) {
        this.storageDir = storageDir;
        this.embeddingsFile = path.join(storageDir, 'embeddings.txt');
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Ensure the storage directory and all parent directories exist
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });  // Create all necessary directories
        }

        if (!fs.existsSync(this.embeddingsFile)) {
            fs.writeFileSync(this.embeddingsFile, '');
        }
    }

    async generateEmbedding(text) {
        const response = await this.openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text,
        });
        return response.data[0].embedding;
    }

    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    async store(text, metas) {
        const id = this.generateUniqueId();
        const embeddings = await this.generateEmbedding(text);

        // Save embedding to embeddings file
        const embeddingLine = `${id}\t${embeddings.join(',')}\n`;
        fs.appendFileSync(this.embeddingsFile, embeddingLine);

        // Save content to file
        const contentFile = path.join(this.storageDir, `${id}.txt`);
        fs.writeFileSync(contentFile, text);

        // Save metas to file
        if (metas) {
            const metaFile = path.join(this.storageDir, `${id}.json`);
            fs.writeFileSync(metaFile, JSON.stringify(metas));
        }

        return { id, embeddings };
    }

    async match(text, count = 5) {
        const queryEmbedding = await this.generateEmbedding(text);

        // Read embeddings from embeddings file
        const embeddingsData = fs.readFileSync(this.embeddingsFile, 'utf-8');
        const lines = embeddingsData.trim().split('\n').filter(line => line);
        const documents = lines.map(line => {
            const [id, embeddingStr] = line.split('\t');
            const embeddings = embeddingStr.split(',').map(Number);
            return { id, embeddings };
        });

        // Compute cosine similarity
        const similarities = documents.map(doc => {
            const similarity = this.cosineSimilarity(queryEmbedding, doc.embeddings);
            return { id: doc.id, similarity };
        });

        // Sort by similarity
        similarities.sort((a, b) => b.similarity - a.similarity);

        // Get top results
        const topResults = similarities.slice(0, count);

        // Retrieve content and embeddings
        const results = topResults.map(result => {
            const contentFile = path.join(this.storageDir, `${result.id}.txt`);
            const content = fs.readFileSync(contentFile, 'utf-8');
            const metaFile = path.join(this.storageDir, `${result.id}.json`);
            let metas = null;
            if (fs.existsSync(metaFile)) {
                metas = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
            }
            const embeddings = documents.find(doc => doc.id === result.id).embeddings;
            return { id: result.id, embeddings, content, score: result.similarity, metas };
        });

        return results;
    }

    cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
        if (magnitudeA === 0 || magnitudeB === 0) return 0;
        return dotProduct / (magnitudeA * magnitudeB);
    }

    delete(id) {
        // Remove entry from embeddings file
        const embeddingsData = fs.readFileSync(this.embeddingsFile, 'utf-8');
        const lines = embeddingsData.trim().split('\n').filter(line => line);
        const filteredLines = lines.filter(line => !line.startsWith(id + '\t'));
        fs.writeFileSync(this.embeddingsFile, filteredLines.join('\n') + '\n');

        // Remove content file
        const contentFile = path.join(this.storageDir, `${id}.txt`);
        if (fs.existsSync(contentFile)) {
            fs.unlinkSync(contentFile);
        }
    }
}

export default Embeddings;

/*
const main = async () => {
    const docStore = new Embeddings('./embeddings_storage_directory')
    const {id, embeddings} = await docStore.store("hello world");
    console.log({id, embeddings})
    const answers = await docStore.match("Bonjour le monde!"); // [{id, embeddings, content}, ...]
    console.log({answers})
    //await docStore.delete(id)
}
main();
*/