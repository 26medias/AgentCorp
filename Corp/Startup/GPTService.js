import fs from 'fs';
import OpenAI from 'openai';

class GPTService {
    constructor(apiKey) {
        this.openai = new OpenAI({
            apiKey: apiKey, // You can also use process.env.OPENAI_API_KEY here
        });
        this.conversationHistory = [];
    }

    // Universal method to call GPT with history support
    async callGPT(systemPrompt, userPrompt, responseType = "json_object", model = "gpt-4o", temperature = 0.7) {
        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                ...this.conversationHistory,
                { role: 'user', content: userPrompt }
            ];

            const response = await this.openai.chat.completions.create({
                model: model,
                messages: messages,
                response_format: { "type": responseType },
                temperature: temperature
            });

            // Save the user's message and the assistant's response to the conversation history
            this.conversationHistory.push({ role: 'user', content: userPrompt });
            this.conversationHistory.push({ role: 'assistant', content: response.choices[0].message.content });

            // Return the message content directly
            return response.choices[0].message.content;
        } catch (error) {
            console.error("Error in GPT API call:", error);
            throw error;
        }
    }

    // Method to load a prompt from file, replace variables, and call GPT
    async ask(promptFilename, variables = {}) {
        try {
            // Load the prompt from file
            const promptData = fs.readFileSync(promptFilename, 'utf8');
            
            // Replace variables in the prompt (e.g., {goal: "my goal"})
            let userPrompt = promptData;
            for (const [key, value] of Object.entries(variables)) {
                const regex = new RegExp(`\\{${key}\\}`, 'g');
                userPrompt = userPrompt.replace(regex, value);
            }

            // Define the system prompt (customizable)
            const systemPrompt = 'You are a helpful assistant specializing in managing AI-driven project teams.';

            // Call GPT with the modified prompt
            const projectSettings = await this.callGPT(systemPrompt, userPrompt);

            // Ensure the response is valid JSON
            try {
                return JSON.parse(projectSettings);
            } catch (error) {
                console.error("Failed to parse GPT response as JSON:", error);
                throw error;
            }
        } catch (error) {
            console.error("Error loading prompt file:", error);
            throw error;
        }
    }
}

export default GPTService;

/*
const apiKey = process.env['OPENAI_API_KEY'];
const gptService = new GPTService(apiKey);

// Load and replace variables in the prompt
(async () => {
    try {
        const response = await gptService.ask('prompts/startup.txt', { goal: "Write a 10000 words hard sci-fi short story about the discovery of a conscious alien creature on the Europa in the year 2124"});
        console.log(JSON.stringify(response, null, 4));
    } catch (error) {
        console.error("Error:", error);
    }
})();
*/