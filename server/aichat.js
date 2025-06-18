import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText } from 'ai';
import bodyParser from 'body-parser';



// Get API key from environment variables
const getAnthropicApiKey = () => {
  // Try multiple sources for the API key
  const apiKey = process.env.ANTHROPIC_API_KEY || 
                 Meteor.settings.private?.anthropicApiKey ||
                 Meteor.settings.private?.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error(' ANTHROPIC_API_KEY not found! Please set it in your environment variables or Meteor settings.');
    console.error('Options:');
    console.error('1. Add ANTHROPIC_API_KEY to your .env file');
    console.error('2. Set it in settings.json under private.anthropicApiKey');
    console.error('3. Export it as an environment variable: export ANTHROPIC_API_KEY=your_key');
    throw new Error('ANTHROPIC_API_KEY is required but not provided');
  }
  
  console.log('✅ Anthropic API key loaded successfully');
  return apiKey;
};

// Initialize Anthropic client with secure API key
let anthropic;
try {
  anthropic = createAnthropic({
    apiKey: getAnthropicApiKey()
  });
  console.log('✅ Anthropic client initialized');
} catch (error) {
  console.error('❌ Failed to initialize Anthropic client:', error.message);
  // Don't crash the server, but chat won't work
  anthropic = null;
}

// System prompt for SSH Terminal assistant
const SYSTEM_PROMPT = `You are an expert SSH Terminal assistant. Your role is to help users with:

1. SSH commands and terminal operations
2. Container management and Docker operations
3. Linux/Unix system administration
4. Terminal troubleshooting and debugging
5. Best practices for secure SSH usage

Keep responses concise but helpful. Provide practical examples when explaining commands. 
Focus on the SSH terminal context and container environment the user is working in.

Guidelines:
- Always prioritize security in your recommendations
- Explain potentially dangerous commands with warnings
- Provide step-by-step instructions for complex tasks
- Suggest alternatives when appropriate
- Ask clarifying questions if the user's intent is unclear`;

// Apply body parser to all chat endpoints
WebApp.connectHandlers.use(bodyParser.json({ limit: '1mb' }));

// Test endpoint to verify API is working
WebApp.connectHandlers.use('/api/chat-test', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end(JSON.stringify({ 
    status: anthropic ? 'Chat API is ready' : 'Chat API not configured - missing API key',
    timestamp: new Date().toISOString(),
    anthropicConfigured: !!anthropic,
    hasApiKey: !!process.env.ANTHROPIC_API_KEY
  }));
});

// Simple chat endpoint (non-streaming)
WebApp.connectHandlers.use('/api/chat-simple', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Check if Anthropic client is available
  if (!anthropic) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'AI service not configured',
      message: 'ANTHROPIC_API_KEY is missing. Please check your environment configuration.'
    }));
    return;
  }

  try {
    console.log('Chat request received, body:', req.body);
    
    // Handle both single message and messages array
    const message = req.body?.message;
    const messages = req.body?.messages;

    let conversationMessages;
    
    if (messages && Array.isArray(messages)) {
      // Use the full conversation
      conversationMessages = messages.map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : msg.role,
        content: msg.content || msg.text
      }));
    } else if (message) {
      // Single message
      conversationMessages = [{ role: 'user', content: message }];
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Message or messages array required' }));
      return;
    }

    console.log('Sending to Anthropic:', conversationMessages);

    // Use generateText for simple completion
    const result = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      system: SYSTEM_PROMPT,
      messages: conversationMessages,
      maxTokens: 1000,
      temperature: 0.7,
    });

    console.log('Anthropic response received:', result.text.substring(0, 100) + '...');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ response: result.text }));

  } catch (error) {
    console.error('Chat API error:', error);
    
    // More detailed error logging
    let errorMessage = 'Failed to get AI response';
    
    if (error.message.includes('API key')) {
      errorMessage = 'Invalid or missing API key';
      console.error('API Key issue - check your Anthropic API key');
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
    } else if (error.message.includes('model')) {
      errorMessage = 'Model not available. Please try again.';
    }
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: errorMessage,
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }));
  }
});

// Streaming chat endpoint
WebApp.connectHandlers.use('/api/chat-stream', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (!anthropic) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'AI service not configured',
      message: 'ANTHROPIC_API_KEY is missing.'
    }));
    return;
  }

  try {
    const messages = req.body?.messages;

    if (!messages || !Array.isArray(messages)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Messages array required' }));
      return;
    }

    // Convert messages to proper format
    const conversationMessages = messages.map(msg => ({
      role: msg.role === 'bot' ? 'assistant' : msg.role,
      content: msg.content || msg.text
    }));

    // Create streaming response
    const result = await streamText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      system: SYSTEM_PROMPT,
      messages: conversationMessages,
      maxTokens: 1000,
      temperature: 0.7,
    });

    // Set headers for streaming
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Stream the response
    for await (const textPart of result.textStream) {
      res.write(textPart);
    }

    res.end();

  } catch (error) {
    console.error('Streaming chat error:', error);
    
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Streaming failed',
        message: error.message 
      }));
    }
  }
});

console.log('AI Chat endpoints initialized successfully');