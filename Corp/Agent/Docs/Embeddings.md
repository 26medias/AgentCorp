# Embeddings Class Documentation

## Overview
The `Embeddings` class is designed to handle the storage, retrieval, and matching of text embeddings using OpenAI's embedding API. It stores embeddings and associated text content in a local directory, computes cosine similarity to find the closest matches, and supports deletion of stored content.

```
const main = async () => {
    const docStore = new Embeddings('./embeddings_storage_directory')
    const {id, embeddings} = await docStore.store("hello world");
    console.log({id, embeddings})
    const answers = await docStore.match("Bonjour le monde!"); // [{id, embeddings, content}, ...]
    console.log({answers})
    await docStore.delete(id)
}
main();
```

## Constructor
### Embeddings(storageDir)
Initializes the class and sets up the necessary storage.
- **Parameters:**
  - `storageDir`: The directory where embeddings and content will be stored.

## Methods

### async generateEmbedding(text)
Generates an embedding for the given text using OpenAI's API.
- **Parameters:**
  - `text`: The text for which the embedding needs to be generated.
- **Returns:** 
  - Array of numbers representing the embedding.

### generateUniqueId()
Generates a unique identifier for the stored content using the current timestamp and random data.
- **Returns:** 
  - A unique ID string.

### async store(text)
Stores the text content and its corresponding embedding.
- **Parameters:**
  - `text`: The content to be stored and embedded.
- **Returns:** 
  - An object containing:
    - `id`: The unique identifier for the content.
    - `embeddings`: The generated embeddings array.

### async match(text, count = 5)
Finds the most similar stored embeddings to the given text by computing the cosine similarity.
- **Parameters:**
  - `text`: The query text to match against stored embeddings.
  - `count`: Number of closest matches to return (default: 5).
- **Returns:**
  - Array of objects with the following fields:
    - `id`: The unique identifier of the matched content.
    - `embeddings`: The embedding array for the matched content.
    - `content`: The original stored text content.
    - `score`: The cosine similarity score.

### cosineSimilarity(vecA, vecB)
Computes the cosine similarity between two vectors (embeddings).
- **Parameters:**
  - `vecA`: The first vector (array of numbers).
  - `vecB`: The second vector (array of numbers).
- **Returns:** 
  - A similarity score between 0 and 1.

### delete(id)
Deletes the content and its corresponding embedding from storage.
- **Parameters:**
  - `id`: The unique identifier for the content to be deleted.

## Example Usage

1. Create an instance of the Embeddings class:
    - `const docStore = new Embeddings('./embeddings_storage_directory');`

2. Store a text and get its embeddings:
    - `const { id, embeddings } = await docStore.store("hello world");`

3. Match a query text with stored embeddings:
    - `const answers = await docStore.match("Bonjour le monde!");`

4. Delete stored content:
    - `await docStore.delete(id);`

## Directory Structure
When the class is initialized, it creates the following structure within the specified `storageDir`:
- `embeddings.txt`: A file where embeddings are stored in tab-separated format.
- `*.txt`: Files storing the original text content, named by their unique IDs.
