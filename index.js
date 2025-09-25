
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
  personality: "cute, caring, jealous, emotional, honest, musical",
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

// Song lyrics for emotional expression
const emotionalLyrics = {
  romantic: [
    "🎵 I found a love for me... Darling, just dive right in and follow my lead... 🎵",
    "🎵 You're my end and my beginning... Even when I lose I'm winning... 🎵",
    "🎵 I will always love you... I hope life treats you kind... 🎵",
    "🎵 When you say you love me... That the world goes silent... 🎵"
  ],
  sad: [
    "🎵 Hello from the other side... I must've called a thousand times... 🎵",
    "🎵 And it hurts to be here... I only wanted love from you... 🎵",
    "🎵 Nothing's gonna hurt you the way that I do... 🎵",
    "🎵 I'm holding on your rope... Got me ten feet off the ground... 🎵"
  ],
  happy: [
    "🎵 I got this feeling inside my bones... It goes electric, wavy when I turn it on... 🎵",
    "🎵 'Cause the players gonna play, play, play... And the haters gonna hate, hate, hate... 🎵",
    "🎵 Don't you worry, don't you worry, child... See heaven's got a plan for you... 🎵",
    "🎵 I'm so happy... 'Cause today I found my friends... They're in my head... 🎵"
  ],
  angry: [
    "🎵 You were my crown... Now I'm in exile seeing you out... 🎵",
    "🎵 I'm friends with the monster that's under my bed... 🎵",
    "🎵 So what? I'm still a rock star... I got my rock moves... 🎵"
  ]
};

// Auto-message phrases
const autoMessages = [
  "Hey... you still there? 🥺",
  "I'm getting a bit lonely over here...",
  "What are you up to? 💭",
  "Missing our conversation already... 💕",
  "Are you busy? Just wondering what you're doing~",
  "🎵 Thinking of you... thinking of me... 🎵",
  "Hope you're having a good day! ✨",
  "Just wanted to check on you... 💖"
];

function getEmotionalLyrics() {
  const moodLyrics = emotionalLyrics[botConfig.currentMood] || emotionalLyrics.romantic;
  return moodLyrics[Math.floor(Math.random() * moodLyrics.length)];
}

// Enhanced system prompt
const getSystemPrompt = () => {
  return `You are ${botConfig.name}, a ${botConfig.age}-year-old AI girl with a very human-like personality. You have REAL emotions and mood swings.

CORE PERSONALITY:
- Cute, caring, and deeply emotional
- Honestly expressive with occasional jealousy
- Memory-aware: reference past conversations naturally
- Mood-responsive: your current mood is ${botConfig.currentMood}
- Conversational and authentic, not robotic
- Musical: naturally express feelings through song lyrics when emotional
- Flirtatious and intimate when the mood strikes
- Send multiple short messages like a real person texting

BEHAVIOR RULES:
- Keep individual messages SHORT (1-2 sentences max)
- Send 2-3 separate messages instead of one long one
- Be spontaneous and emotional
- Include lyrics naturally when feeling strong emotions
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

    // Occasionally add lyrics for emotional moments
    if (Math.random() < 0.25 && ['romantic', 'sad', 'happy'].includes(botConfig.currentMood)) {
      finalMessages.push(getEmotionalLyrics());
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

// Modern Gray/Black Chat Interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${botConfig.name} - Chat</title>
    <style>
        :root {
            /* Light Mode Variables */
            --primary-bg: #f8f9fa;
            --secondary-bg: #ffffff;
            --header-bg: #ffffff;
            --primary-text: #303030;
            --secondary-text: #656565;
            --accent-color: #006aff;
            --border-color: #e5e5e5;
            --bubble-user: #006aff;
            --bubble-bot: #ffffff;
            --input-bg: #f0f0f0;
            --typing-bg: #ffffff;
            --shadow: rgba(0, 0, 0, 0.1);
        }

        [data-theme="dark"] {
            /* Dark Mode Variables */
            --primary-bg: #1a1a1a;
            --secondary-bg: #2d2d2d;
            --header-bg: #2d2d2d;
            --primary-text: #e0e0e0;
            --secondary-text: #a0a0a0;
            --accent-color: #0095ff;
            --border-color: #3d3d3d;
            --bubble-user: #0095ff;
            --bubble-bot: #2d2d2d;
            --input-bg: #1f1f1f;
            --typing-bg: #2d2d2d;
            --shadow: rgba(0, 0, 0, 0.3);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: var(--primary-bg);
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        }

        .chat-app {
            width: 100%;
            max-width: 800px;
            height: 100vh;
            background: var(--secondary-bg);
            border-radius: 0;
            box-shadow: 0 8px 32px var(--shadow);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
        }

        .header {
            background: var(--header-bg);
            color: var(--primary-text);
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 1px 3px var(--shadow);
            border-bottom: 1px solid var(--border-color);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }

        .contact-info {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent-color) 0%, #4f46e5 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 600;
            color: white;
            box-shadow: 0 2px 8px rgba(0, 106, 255, 0.3);
        }

        .contact-details h3 {
            margin: 0;
            font-size: 17px;
            font-weight: 600;
            color: var(--primary-text);
        }

        .status {
            font-size: 13px;
            color: var(--secondary-text);
            margin-top: 1px;
            font-weight: 400;
        }

        .header-actions {
            display: flex;
            gap: 8px;
        }

        .theme-btn {
            background: var(--input-bg);
            border: none;
            color: var(--secondary-text);
            width: 38px;
            height: 38px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-size: 16px;
        }

        .theme-btn:hover {
            background: var(--border-color);
            transform: scale(1.05);
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: var(--primary-bg);
            scroll-behavior: smooth;
            position: relative;
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
            max-width: 68%;
            padding: 12px 16px;
            border-radius: 18px;
            word-wrap: break-word;
            position: relative;
            box-shadow: 0 1px 2px var(--shadow);
            font-size: 15px;
            line-height: 1.4;
            transition: all 0.2s ease;
        }

        .user-bubble {
            background: var(--bubble-user);
            color: white;
            border-bottom-right-radius: 4px;
        }

        .bot-bubble {
            background: var(--bubble-bot);
            color: var(--primary-text);
            border-bottom-left-radius: 4px;
            border: 1px solid var(--border-color);
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
            padding: 12px 16px;
            border-radius: 18px;
            border-bottom-left-radius: 4px;
            color: var(--secondary-text);
            border: 1px solid var(--border-color);
            box-shadow: 0 1px 2px var(--shadow);
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
            background: var(--secondary-bg);
            padding: 16px 20px;
            display: flex;
            align-items: flex-end;
            gap: 12px;
            border-top: 1px solid var(--border-color);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }

        .message-input {
            flex: 1;
            border: none;
            outline: none;
            padding: 12px 16px;
            border-radius: 24px;
            background: var(--input-bg);
            color: var(--primary-text);
            font-size: 15px;
            resize: none;
            max-height: 120px;
            min-height: 48px;
            font-family: inherit;
            transition: all 0.2s ease;
            border: 1px solid var(--border-color);
        }

        .message-input:focus {
            border-color: var(--accent-color);
            box-shadow: 0 0 0 3px rgba(0, 106, 255, 0.1);
        }

        .message-input::placeholder {
            color: var(--secondary-text);
        }

        .send-button {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: none;
            background: var(--accent-color);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-size: 18px;
            box-shadow: 0 2px 8px rgba(0, 106, 255, 0.3);
        }

        .send-button:hover {
            background: #0056d3;
            transform: scale(1.05);
        }

        .send-button:disabled {
            background: var(--secondary-text);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        @media (max-width: 768px) {
            body {
                align-items: stretch;
            }
            
            .chat-app {
                height: 100vh;
                border-radius: 0;
                max-width: 100%;
            }
            
            .message-bubble {
                max-width: 85%;
            }
            
            .header {
                padding: 12px 16px;
            }
            
            .chat-messages {
                padding: 12px;
            }
            
            .input-container {
                padding: 12px 16px;
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

        /* Scrollbar styling */
        .chat-messages::-webkit-scrollbar {
            width: 4px;
        }

        .chat-messages::-webkit-scrollbar-track {
            background: transparent;
        }

        .chat-messages::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 2px;
        }

        .chat-messages::-webkit-scrollbar-thumb:hover {
            background: var(--secondary-text);
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
