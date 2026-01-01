
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { context, userMessage } = req.body;

    // 1. Get API Key from Header (User Setting) or Env (Server Default)
    const apiKey = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(401).json({ error: 'API Key is missing. Please set it in Settings.' });
    }

    if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Format context for the prompt
        const contextString = context.map(p => `[${p.author}]: ${p.title}`).join('\n');

        const prompt = `
    You are role-playing as a user on a Korean internet community "DC Inside".
    Here is the recent chat history (live reactions to a stream):
    ---
    ${contextString}
    ---

    A user just posted: "[나(User)]: ${userMessage}"

    Please generate 1 or 2 short, realistic reactions from other users to this post.
    
    Rules:
    1. Use Korean internet slang (ㅋㅋ, ㄹㅇ, ㄴㄴ, etc) naturally.
    2. Be casual, sometimes cynical, sometimes enthusiastic, matching the vibe of "DC Inside".
    3. Keep it short (1-5 words usually).
    4. Return ONLY a JSON array of strings. Example: ["ㄹㅇㅋㅋ", "머라노"]
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("Gemini Raw Response:", text);

        // Extract JSON from potential markdown code blocks
        const jsonMatch = text.match(/\[.*\]/s);
        if (!jsonMatch) {
            throw new Error("Failed to parse JSON from AI response");
        }

        const reactions = JSON.parse(jsonMatch[0]);

        res.status(200).json({ reactions });
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: 'AI Generation Failed', details: error.message });
    }
}
