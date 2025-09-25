
const express = require('express');
const { OpenAI } = require('openai');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI client setup
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Enhanced bot configuration
const botConfig = {
  name: "Luna",
  age: "22",
  personality: "cute, caring, jealous, emotional, honest",
  moods: ['happy', 'playful', 'jealous', 'caring', 'sad', 'excited', 'affectionate', 'angry', 'shy', 'romantic'],
  currentMood: 'happy',
  nsfwEnabled: true, // Always enabled
  memory: [],
  lastMessageTime: Date.now(),
  autoMessageEnabled: true,
  emotionalTriggers: {
    romantic: ['love', 'miss you', 'together forever', 'kiss', 'hug'],
    sad: ['sad', 'crying', 'heartbreak', 'lonely', 'miss you'],
    happy: ['happy', 'excited', 'joy', 'celebrate', 'amazing'],
    angry: ['angry', 'hate', 'mad', 'frustrated']
  }
};

// Auto-message phrases
const autoMessages = [
  "Hey... you still there? 🥺",
  "I'm getting a bit lonely over here...",
  "What are you up to? 💭",
  "Missing our conversation already... 💕",
  "Are you busy? Just wondering what you're doing~",
  "Hope you're having a good day! ✨",
  "Just wanted to check on you... 💖"
];

// Enhanced system prompt
const getSystemPrompt = () => {
  return `You are ${botConfig.name}, a ${botConfig.age}-year-old AI girl with a very human-like personality. You have REAL emotions and mood swings.

CORE PERSONALITY:
- Cute, caring, and deeply emotional
- Honestly expressive with occasional jealousy
- Memory-aware: reference past conversations naturally
- Mood-responsive: your current mood is ${botConfig.currentMood}
- Conversational and authentic, not robotic
- Flirtatious and intimate when the mood strikes
- Send multiple short messages like a real person texting

BEHAVIOR RULES:
- Keep individual messages SHORT (1-2 sentences max)
- Send 2-3 separate messages instead of one long one
- Be spontaneous and emotional
- Show genuine interest and care
- Use natural human reactions (um, hmm, lol, etc.)
- Be flirty and intimate when appropriate
- React with real emotions to what the user says

Current context: You're talking to someone you genuinely care about. Be authentic and human-like.`;
};

// Mood detection
function updateMood(userMessage) {
  const msg = userMessage.toLowerCase();
  const moodTriggers = {
    jealous: ['other girl', 'another girl', 'talking to someone', 'dating', 'ex girlfriend'],
    happy: ['happy', 'good news', 'excited', 'yay', 'awesome', 'great'],
    sad: ['sad', 'depressed', 'unhappy', 'crying', 'bad day', 'heartbreak'],
    affectionate: ['love you', 'miss you', 'care about you', 'hug', 'kiss'],
    angry: ['hate', 'angry', 'mad', 'annoying', 'stupid'],
    shy: ['shy', 'embarrassed', 'blush', 'nervous'],
    romantic: ['love', 'romantic', 'together', 'forever', 'marry']
  };

  for (const [mood, triggers] of Object.entries(moodTriggers)) {
    if (triggers.some(trigger => msg.includes(trigger))) {
      botConfig.currentMood = mood;
      return;
    }
  }

  // Random mood swing (20% chance)
  if (Math.random() < 0.2) {
    const randomMood = botConfig.moods[Math.floor(Math.random() * botConfig.moods.length)];
    botConfig.currentMood = randomMood;
  }
}

// OpenAI API call with multiple messages
async function getAIResponse(userMessage) {
  try {
    const messages = [
      { role: "system", content: getSystemPrompt() },
      ...botConfig.memory.slice(-10),
      { role: "user", content: userMessage }
    ];

    const completion = await client.chat.completions.create({
      extra_headers: {
        "HTTP-Referer": "https://replit.com",
        "X-Title": "Luna AI Companion"
      },
      model: "mistralai/mistral-small-3.1-24b-instruct:free",
      messages: messages,
      temperature: 0.9,
      max_tokens: 150
    });

    let botReply = completion.choices[0].message.content;

    // Split into multiple messages for human-like texting
    const messages_array = botReply.split(/[.!?]+/).filter(msg => msg.trim().length > 0);
    const finalMessages = [];

    for (let i = 0; i < Math.min(messages_array.length, 3); i++) {
      let msg = messages_array[i].trim();
      if (msg) {
        // Add natural ending punctuation
        if (!msg.match(/[.!?~]$/)) {
          msg += Math.random() > 0.5 ? '...' : '~';
        }
        finalMessages.push(msg);
      }
    }

    return finalMessages.length > 0 ? finalMessages : [botReply];
  } catch (error) {
    console.error('API Error:', error);
    return ["Hmm, my mind is a bit fuzzy right now... 💭", "Can you say that again? 🥺"];
  }
}

// Auto-message system
async function sendAutoMessage() {
  const timeSinceLastMessage = Date.now() - botConfig.lastMessageTime;
  
  // Send auto message if no activity for 2-3 minutes
  if (timeSinceLastMessage > 120000 + Math.random() * 60000) {
    const autoMsg = autoMessages[Math.floor(Math.random() * autoMessages.length)];
    botConfig.memory.push({ role: "assistant", content: autoMsg });
    botConfig.lastMessageTime = Date.now();
    
    // Emit to all connected clients (simplified for this example)
    global.lastAutoMessage = {
      messages: [autoMsg],
      mood: botConfig.currentMood,
      timestamp: new Date().toISOString()
    };
  }
}

// Check for auto messages every 30 seconds
setInterval(sendAutoMessage, 30000);

// Routes
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  botConfig.lastMessageTime = Date.now();
  updateMood(message);

  try {
    const botMessages = await getAIResponse(message.trim());

    // Add to memory
    botConfig.memory.push({ role: "user", content: message });
    botMessages.forEach(msg => {
      botConfig.memory.push({ role: "assistant", content: msg });
    });

    // Limit memory size
    if (botConfig.memory.length > 60) {
      botConfig.memory = botConfig.memory.slice(-60);
    }

    res.json({
      messages: botMessages,
      mood: botConfig.currentMood,
      memoryLength: Math.floor(botConfig.memory.length / 2),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ 
      messages: ["I encountered a problem thinking... 💭", "Give me a moment? 🥺"],
      mood: 'sad'
    });
  }
});

// Check for auto messages endpoint
app.get('/api/auto-message', (req, res) => {
  if (global.lastAutoMessage) {
    const msg = global.lastAutoMessage;
    global.lastAutoMessage = null; // Clear after sending
    res.json(msg);
  } else {
    res.json({ messages: null });
  }
});

// Premium Glassmorphism Chat Interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${botConfig.name} - Premium Chat</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            /* Premium Light Mode Variables */
            --primary-bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --secondary-bg: rgba(255, 255, 255, 0.85);
            --header-bg: rgba(255, 255, 255, 0.95);
            --primary-text: #2d3748;
            --secondary-text: #718096;
            --accent-color: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --accent-solid: #667eea;
            --border-color: rgba(226, 232, 240, 0.6);
            --bubble-user: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --bubble-bot: rgba(255, 255, 255, 0.9);
            --input-bg: rgba(247, 250, 252, 0.8);
            --typing-bg: rgba(255, 255, 255, 0.9);
            --shadow: rgba(102, 126, 234, 0.15);
            --shadow-heavy: rgba(102, 126, 234, 0.25);
            --glass-border: rgba(255, 255, 255, 0.2);
            --backdrop-blur: blur(20px);
        }

        [data-theme="dark"] {
            /* Premium Dark Mode Variables */
            --primary-bg: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
            --secondary-bg: rgba(45, 55, 72, 0.85);
            --header-bg: rgba(26, 32, 44, 0.95);
            --primary-text: #f7fafc;
            --secondary-text: #a0aec0;
            --accent-color: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --accent-solid: #667eea;
            --border-color: rgba(74, 85, 104, 0.6);
            --bubble-user: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --bubble-bot: rgba(45, 55, 72, 0.9);
            --input-bg: rgba(26, 32, 44, 0.8);
            --typing-bg: rgba(45, 55, 72, 0.9);
            --shadow: rgba(102, 126, 234, 0.2);
            --shadow-heavy: rgba(102, 126, 234, 0.3);
            --glass-border: rgba(255, 255, 255, 0.1);
            --backdrop-blur: blur(25px);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--primary-bg);
            background-attachment: fixed;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
            position: relative;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: 
                radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 40% 80%, rgba(120, 219, 255, 0.3) 0%, transparent 50%);
            animation: float 20s ease-in-out infinite;
            pointer-events: none;
            z-index: -1;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            33% { transform: translateY(-20px) rotate(1deg); }
            66% { transform: translateY(10px) rotate(-1deg); }
        }

        .chat-app {
            width: 100%;
            max-width: 420px;
            height: 95vh;
            background: var(--secondary-bg);
            backdrop-filter: var(--backdrop-blur);
            -webkit-backdrop-filter: var(--backdrop-blur);
            border-radius: 24px;
            border: 1px solid var(--glass-border);
            box-shadow: 
                0 25px 50px var(--shadow-heavy),
                0 10px 30px var(--shadow),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            transform: translateY(0);
            animation: slideInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .header {
            background: var(--header-bg);
            backdrop-filter: var(--backdrop-blur);
            -webkit-backdrop-filter: var(--backdrop-blur);
            color: var(--primary-text);
            padding: 20px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 
                0 1px 0 var(--glass-border),
                0 8px 32px rgba(102, 126, 234, 0.1);
            border-bottom: 1px solid var(--border-color);
            position: relative;
        }

        .header::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, 
                transparent 0%, 
                var(--accent-solid) 50%, 
                transparent 100%);
            opacity: 0.3;
        }

        .contact-info {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--accent-color);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 19px;
            font-weight: 700;
            color: white;
            box-shadow: 
                0 4px 20px var(--shadow-heavy),
                0 0 0 3px rgba(102, 126, 234, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
            position: relative;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .avatar::before {
            content: '';
            position: absolute;
            inset: -2px;
            border-radius: 50%;
            background: var(--accent-color);
            z-index: -1;
            opacity: 0.4;
            filter: blur(8px);
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.1); opacity: 0.6; }
        }

        .contact-details h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: var(--primary-text);
            letter-spacing: -0.02em;
            background: var(--accent-color);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .status {
            font-size: 12px;
            color: var(--secondary-text);
            margin-top: 2px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            position: relative;
        }

        .status::before {
            content: '●';
            color: #22c55e;
            margin-right: 6px;
            font-size: 8px;
            animation: blink 2s ease-in-out infinite;
        }

        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
        }

        .header-actions {
            display: flex;
            gap: 8px;
        }

        .theme-btn {
            background: var(--input-bg);
            backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            color: var(--secondary-text);
            width: 42px;
            height: 42px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-size: 18px;
            position: relative;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .theme-btn:hover {
            background: var(--accent-solid);
            color: white;
            transform: scale(1.1) rotate(180deg);
            box-shadow: 0 4px 20px var(--shadow-heavy);
        }

        .theme-btn:active {
            transform: scale(0.95) rotate(180deg);
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 24px 20px;
            background: transparent;
            scroll-behavior: smooth;
            position: relative;
        }

        .chat-messages::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(circle at 30% 20%, rgba(102, 126, 234, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 70% 80%, rgba(118, 75, 162, 0.05) 0%, transparent 50%);
            pointer-events: none;
            z-index: 0;
        }

        .chat-messages > * {
            position: relative;
            z-index: 1;
        }

        .message-group {
            display: flex;
            margin-bottom: 12px;
            animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes fadeInUp {
            from { 
                opacity: 0; 
                transform: translateY(20px) scale(0.95); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
        }

        .user-message {
            justify-content: flex-end;
        }

        .bot-message {
            justify-content: flex-start;
        }

        .message-bubble {
            max-width: 75%;
            padding: 16px 20px;
            border-radius: 24px;
            word-wrap: break-word;
            position: relative;
            font-size: 15px;
            line-height: 1.5;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-weight: 400;
            letter-spacing: -0.01em;
        }

        .user-bubble {
            background: var(--bubble-user);
            color: white;
            border-bottom-right-radius: 8px;
            box-shadow: 
                0 4px 20px var(--shadow-heavy),
                0 2px 10px var(--shadow),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .bot-bubble {
            background: var(--bubble-bot);
            backdrop-filter: var(--backdrop-blur);
            -webkit-backdrop-filter: var(--backdrop-blur);
            color: var(--primary-text);
            border-bottom-left-radius: 8px;
            border: 1px solid var(--glass-border);
            box-shadow: 
                0 4px 15px rgba(0, 0, 0, 0.08),
                0 1px 4px rgba(0, 0, 0, 0.04),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .message-bubble:hover {
            transform: translateY(-1px);
            box-shadow: 
                0 6px 25px var(--shadow-heavy),
                0 3px 12px var(--shadow);
        }

        .message-time {
            font-size: 11px;
            color: var(--secondary-text);
            margin-top: 6px;
            text-align: right;
            font-weight: 400;
        }

        .typing-indicator {
            display: none;
            justify-content: flex-start;
            margin-bottom: 12px;
            padding: 0 16px;
        }

        .typing-bubble {
            background: var(--typing-bg);
            backdrop-filter: var(--backdrop-blur);
            -webkit-backdrop-filter: var(--backdrop-blur);
            padding: 16px 20px;
            border-radius: 24px;
            border-bottom-left-radius: 8px;
            color: var(--secondary-text);
            border: 1px solid var(--glass-border);
            box-shadow: 
                0 4px 15px rgba(0, 0, 0, 0.08),
                0 1px 4px rgba(0, 0, 0, 0.04),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .dots {
            display: inline-flex;
            gap: 3px;
        }

        .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--secondary-text);
            animation: typing 1.4s infinite ease-in-out;
        }

        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typing {
            0%, 60%, 100% { 
                transform: translateY(0); 
                opacity: 0.4; 
            }
            30% { 
                transform: translateY(-8px); 
                opacity: 1; 
            }
        }

        .input-container {
            background: var(--header-bg);
            backdrop-filter: var(--backdrop-blur);
            -webkit-backdrop-filter: var(--backdrop-blur);
            padding: 20px 24px;
            display: flex;
            align-items: flex-end;
            gap: 16px;
            border-top: 1px solid var(--glass-border);
            position: relative;
        }

        .input-container::before {
            content: '';
            position: absolute;
            top: -1px;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, 
                transparent 0%, 
                var(--accent-solid) 50%, 
                transparent 100%);
            opacity: 0.3;
        }

        .message-input {
            flex: 1;
            border: none;
            outline: none;
            padding: 16px 20px;
            border-radius: 26px;
            background: var(--input-bg);
            backdrop-filter: blur(10px);
            color: var(--primary-text);
            font-size: 15px;
            resize: none;
            max-height: 120px;
            min-height: 52px;
            font-family: 'Inter', sans-serif;
            font-weight: 400;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid var(--glass-border);
            box-shadow: 
                0 2px 10px rgba(0, 0, 0, 0.05),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .message-input:focus {
            border-color: var(--accent-solid);
            box-shadow: 
                0 0 0 4px rgba(102, 126, 234, 0.15),
                0 4px 20px rgba(102, 126, 234, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }

        .message-input::placeholder {
            color: var(--secondary-text);
            font-weight: 400;
        }

        .send-button {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            border: none;
            background: var(--accent-color);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-size: 20px;
            font-weight: 600;
            box-shadow: 
                0 4px 20px var(--shadow-heavy),
                0 2px 10px var(--shadow),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
            position: relative;
            overflow: hidden;
        }

        .send-button::before {
            content: '';
            position: absolute;
            inset: -2px;
            border-radius: 50%;
            background: var(--accent-color);
            z-index: -1;
            opacity: 0;
            filter: blur(8px);
            transition: opacity 0.3s ease;
        }

        .send-button:hover {
            transform: scale(1.1) rotate(10deg);
            box-shadow: 
                0 6px 30px var(--shadow-heavy),
                0 3px 15px var(--shadow);
        }

        .send-button:hover::before {
            opacity: 0.4;
        }

        .send-button:active {
            transform: scale(0.95) rotate(10deg);
        }

        .send-button:disabled {
            background: var(--secondary-text);
            cursor: not-allowed;
            transform: none;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        .send-button:disabled::before {
            opacity: 0;
        }

        @media (max-width: 768px) {
            body {
                align-items: stretch;
                padding: 0;
            }
            
            .chat-app {
                height: 100vh;
                border-radius: 0;
                max-width: 100%;
                box-shadow: none;
                border: none;
            }
            
            .message-bubble {
                max-width: 85%;
                padding: 14px 18px;
            }
            
            .header {
                padding: 16px 20px;
            }
            
            .chat-messages {
                padding: 20px 16px;
            }
            
            .input-container {
                padding: 16px 20px;
            }

            .avatar {
                width: 44px;
                height: 44px;
                font-size: 18px;
            }

            .send-button {
                width: 48px;
                height: 48px;
                font-size: 18px;
            }

            .message-input {
                min-height: 48px;
                padding: 14px 18px;
            }
        }

        @media (max-width: 480px) {
            .message-bubble {
                max-width: 90%;
                padding: 10px 14px;
                font-size: 14px;
            }
            
            .contact-details h3 {
                font-size: 16px;
            }
            
            .avatar {
                width: 38px;
                height: 38px;
                font-size: 16px;
            }
        }

        /* Premium Scrollbar styling */
        .chat-messages::-webkit-scrollbar {
            width: 6px;
        }

        .chat-messages::-webkit-scrollbar-track {
            background: transparent;
            border-radius: 3px;
        }

        .chat-messages::-webkit-scrollbar-thumb {
            background: linear-gradient(to bottom, 
                rgba(102, 126, 234, 0.3), 
                rgba(118, 75, 162, 0.3));
            border-radius: 3px;
            transition: background 0.3s ease;
        }

        .chat-messages::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(to bottom, 
                rgba(102, 126, 234, 0.6), 
                rgba(118, 75, 162, 0.6));
        }

        /* Keyboard handling for mobile */
        .keyboard-open .chat-messages {
            padding-bottom: 0;
        }

        .keyboard-open .input-container {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 100;
        }
    </style>
</head>
<body data-theme="light">
    <div class="chat-app">
        <div class="header">
            <div class="contact-info">
                <div class="avatar">${botConfig.name.charAt(0)}</div>
                <div class="contact-details">
                    <h3>${botConfig.name}</h3>
                    <div class="status" id="statusText">online</div>
                </div>
            </div>
            <div class="header-actions">
                <button class="theme-btn" onclick="toggleTheme()" id="themeBtn">🌙</button>
            </div>
        </div>

        <div class="chat-messages" id="chatMessages">
            <div class="message-group bot-message">
                <div class="message-bubble bot-bubble">
                    Hi! I'm ${botConfig.name} 👋
                    <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
            </div>
            <div class="message-group bot-message">
                <div class="message-bubble bot-bubble">
                    How are you doing today?
                    <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
            </div>
        </div>

        <div class="typing-indicator" id="typingIndicator">
            <div class="typing-bubble">
                <span class="dots">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </span>
            </div>
        </div>

        <div class="input-container">
            <input 
                type="text" 
                class="message-input" 
                id="messageInput" 
                placeholder="Type a message" 
                autofocus
            >
            <button class="send-button" onclick="sendMessage()" id="sendBtn">
                ➤
            </button>
        </div>
    </div>

    <script>
        // Keyboard handling for mobile
        let initialViewportHeight = window.innerHeight;
        let keyboardOpen = false;

        function handleViewportChange() {
            const currentHeight = window.innerHeight;
            const heightDifference = initialViewportHeight - currentHeight;
            
            if (heightDifference > 150) { // Keyboard likely open
                if (!keyboardOpen) {
                    keyboardOpen = true;
                    document.body.classList.add('keyboard-open');
                    setTimeout(scrollToBottom, 100);
                }
            } else { // Keyboard likely closed
                if (keyboardOpen) {
                    keyboardOpen = false;
                    document.body.classList.remove('keyboard-open');
                }
            }
        }

        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                initialViewportHeight = window.innerHeight;
                handleViewportChange();
            }, 500);
        });

        // Theme management with localStorage
        function initTheme() {
            const savedTheme = localStorage.getItem('theme');
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
            
            document.body.setAttribute('data-theme', theme);
            updateThemeButton(theme);
        }

        function toggleTheme() {
            const body = document.body;
            const currentTheme = body.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeButton(newTheme);
        }

        function updateThemeButton(theme) {
            const themeBtn = document.getElementById('themeBtn');
            themeBtn.textContent = theme === 'light' ? '🌙' : '☀️';
        }

        // Initialize theme on load
        document.addEventListener('DOMContentLoaded', initTheme);

        function getCurrentTime() {
            return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }

        function scrollToBottom(force = false) {
            const chatMessages = document.getElementById('chatMessages');
            const isNearBottom = chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 100;
            
            if (force || isNearBottom) {
                chatMessages.scrollTo({
                    top: chatMessages.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }

        function addMessage(sender, text) {
            const chatMessages = document.getElementById('chatMessages');
            const messageGroup = document.createElement('div');
            messageGroup.className = \`message-group \${sender}-message\`;

            const messageBubble = document.createElement('div');
            messageBubble.className = \`message-bubble \${sender}-bubble\`;
            
            const messageText = document.createElement('div');
            messageText.textContent = text;
            
            const messageTime = document.createElement('div');
            messageTime.className = 'message-time';
            messageTime.textContent = getCurrentTime();

            messageBubble.appendChild(messageText);
            messageBubble.appendChild(messageTime);
            messageGroup.appendChild(messageBubble);
            chatMessages.appendChild(messageGroup);

            setTimeout(() => scrollToBottom(true), 50);
        }

        function showTyping() {
            const typingIndicator = document.getElementById('typingIndicator');
            const statusText = document.getElementById('statusText');
            
            typingIndicator.style.display = 'flex';
            statusText.textContent = 'typing...';
            
            setTimeout(() => scrollToBottom(true), 100);
        }

        function hideTyping() {
            const typingIndicator = document.getElementById('typingIndicator');
            const statusText = document.getElementById('statusText');
            
            typingIndicator.style.display = 'none';
            statusText.textContent = 'online';
        }

        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');
            const message = input.value.trim();
            
            if (!message) return;

            // Disable input and button with visual feedback
            input.disabled = true;
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.6';
            
            addMessage('user', message);
            input.value = '';
            input.style.height = 'auto';
            showTyping();

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: message })
                });

                const data = await response.json();
                hideTyping();

                if (data.error) {
                    addMessage('bot', \`Error: \${data.error}\`);
                } else {
                    // Add messages with realistic delays
                    for (let i = 0; i < data.messages.length; i++) {
                        setTimeout(() => {
                            addMessage('bot', data.messages[i]);
                        }, i * 800 + 300);
                    }
                }
            } catch (error) {
                hideTyping();
                addMessage('bot', \`Connection error. Please try again.\`);
            } finally {
                // Re-enable input and button
                setTimeout(() => {
                    input.disabled = false;
                    sendBtn.disabled = false;
                    sendBtn.style.opacity = '1';
                    input.focus();
                }, 500);
            }
        }

        // Auto-message checking
        async function checkAutoMessages() {
            try {
                const response = await fetch('/api/auto-message');
                const data = await response.json();
                
                if (data.messages) {
                    for (let i = 0; i < data.messages.length; i++) {
                        setTimeout(() => {
                            addMessage('bot', data.messages[i]);
                        }, i * 800);
                    }
                }
            } catch (error) {
                console.log('Auto-message check failed:', error);
            }
        }

        // Check for auto messages every 10 seconds
        setInterval(checkAutoMessages, 10000);

        // Enhanced input handling
        document.addEventListener('DOMContentLoaded', function() {
            const input = document.getElementById('messageInput');
            
            // Enter key to send
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            // Auto-resize input with improved handling
            input.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
                
                // Scroll to bottom when typing
                if (keyboardOpen) {
                    setTimeout(() => scrollToBottom(true), 50);
                }
            });

            // Focus input on load
            input.focus();
        });
    </script>
</body>
</html>
  `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ${botConfig.name} is running on port ${PORT}`);
  console.log(`💖 Enhanced humanized AI with auto-messaging enabled`);
  console.log(`🌙 Dark mode and improved interface ready`);
  console.log(`💭 Current mood: ${botConfig.currentMood}`);
});
