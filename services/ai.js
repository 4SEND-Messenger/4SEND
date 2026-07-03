const axios = require('axios');

const getApiKeys = () => {
    return [process.env.GEMINI_API_KEY_THREE, process.env.GEMINI_API_KEY_TWO, process.env.GEMINI_API_KEY].filter(Boolean);
};

const getAvailableModels = async (key) => {
    const modelsRes = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, { timeout: 5000 });
    const models = modelsRes.data.models || [];
    return models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini'))
        .map(m => m.name.replace('models/', ''));
};

const callGemini = async (model, key, payload, timeout = 30000) => {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const response = await axios.post(geminiUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout
    });
    return response.data;
};

const createSafetySettings = () => [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

module.exports = { getApiKeys, getAvailableModels, callGemini, createSafetySettings };
