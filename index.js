
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

// Clean WhatsApp-inspired Web Interface
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
            --primary-green: #25d366;
            --dark-green: #128c7e;
            --light-green: #dcf8c6;
            --gray-bg: #f0f0f0;
            --dark-bg: #111b21;
            --dark-surface: #202c33;
            --dark-input: #2a3942;
            --white: #ffffff;
            --dark-text: #e9edef;
            --light-text: #667781;
            --bubble-light: #ffffff;
            --bubble-dark: #005c4b;
        }

        [data-theme="dark"] {
            --gray-bg: var(--dark-bg);
            --white: var(--dark-surface);
            --bubble-light: var(--dark-surface);
            --light-text: var(--dark-text);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--gray-bg);
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.3s ease;
        }

        .chat-app {
            width: 100%;
            max-width: 800px;
            height: 90vh;
            background: var(--white);
            border-radius: 8px;
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .header {
            background: var(--primary-green);
            color: white;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .contact-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: bold;
        }

        .contact-details h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 500;
        }

        .status {
            font-size: 13px;
            opacity: 0.9;
            margin-top: 2px;
        }

        .header-actions {
            display: flex;
            gap: 10px;
        }

        .theme-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.3s ease;
        }

        .theme-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: var(--gray-bg);
            scroll-behavior: smooth;
        }

        .message-group {
            display: flex;
            margin-bottom: 8px;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .user-message {
            justify-content: flex-end;
        }

        .bot-message {
            justify-content: flex-start;
        }

        .message-bubble {
            max-width: 65%;
            padding: 8px 12px;
            border-radius: 7.5px;
            word-wrap: break-word;
            position: relative;
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
        }

        .user-bubble {
            background: var(--light-green);
            color: #303030;
            border-bottom-right-radius: 2px;
        }

        .bot-bubble {
            background: var(--bubble-light);
            color: var(--light-text);
            border-bottom-left-radius: 2px;
        }

        [data-theme="dark"] .bot-bubble {
            background: var(--dark-surface);
            color: var(--dark-text);
        }

        [data-theme="dark"] .user-bubble {
            background: var(--bubble-dark);
            color: white;
        }

        .message-time {
            font-size: 11px;
            opacity: 0.6;
            margin-top: 4px;
            text-align: right;
        }

        .typing-indicator {
            display: none;
            justify-content: flex-start;
            margin-bottom: 8px;
        }

        .typing-bubble {
            background: var(--bubble-light);
            padding: 12px 16px;
            border-radius: 18px;
            border-bottom-left-radius: 4px;
            color: var(--light-text);
        }

        [data-theme="dark"] .typing-bubble {
            background: var(--dark-surface);
            color: var(--dark-text);
        }

        .dots {
            display: inline-flex;
            gap: 2px;
        }

        .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--light-text);
            animation: typing 1.4s infinite;
        }

        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.75; }
            30% { transform: translateY(-10px); opacity: 1; }
        }

        .input-container {
            background: var(--white);
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-top: 1px solid #e5e5e5;
        }

        [data-theme="dark"] .input-container {
            background: var(--dark-surface);
            border-top-color: #3b4a54;
        }

        .message-input {
            flex: 1;
            border: none;
            outline: none;
            padding: 9px 12px;
            border-radius: 21px;
            background: #f0f0f0;
            color: #3b4a54;
            font-size: 15px;
            resize: none;
            max-height: 100px;
        }

        [data-theme="dark"] .message-input {
            background: var(--dark-input);
            color: var(--dark-text);
        }

        .message-input::placeholder {
            color: #8696a0;
        }

        .send-button {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background: var(--primary-green);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.3s ease;
        }

        .send-button:hover {
            background: var(--dark-green);
        }

        .send-button:disabled {
            background: #bbb;
            cursor: not-allowed;
        }

        @media (max-width: 768px) {
            .chat-app {
                height: 100vh;
                border-radius: 0;
                max-width: 100%;
            }
            
            .message-bubble {
                max-width: 80%;
            }
        }

        /* Scrollbar styling */
        .chat-messages::-webkit-scrollbar {
            width: 6px;
        }

        .chat-messages::-webkit-scrollbar-track {
            background: transparent;
        }

        .chat-messages::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
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
        function toggleTheme() {
            const body = document.body;
            const themeBtn = document.getElementById('themeBtn');
            
            if (body.getAttribute('data-theme') === 'light') {
                body.setAttribute('data-theme', 'dark');
                themeBtn.textContent = '☀️';
            } else {
                body.setAttribute('data-theme', 'light');
                themeBtn.textContent = '🌙';
            }
        }

        function getCurrentTime() {
            return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }

        function addMessage(sender, text, isLyrics = false) {
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

            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function showTyping() {
            const typingIndicator = document.getElementById('typingIndicator');
            const statusText = document.getElementById('statusText');
            
            typingIndicator.style.display = 'flex';
            statusText.textContent = 'typing...';
            
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.scrollTop = chatMessages.scrollHeight;
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

            // Disable input and button
            input.disabled = true;
            sendBtn.disabled = true;
            
            addMessage('user', message);
            input.value = '';
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
                        }, i * 1000);
                    }
                }
            } catch (error) {
                hideTyping();
                addMessage('bot', \`Connection error. Please try again.\`);
            } finally {
                // Re-enable input and button
                input.disabled = false;
                sendBtn.disabled = false;
                input.focus();
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
                        }, i * 1000);
                    }
                }
            } catch (error) {
                console.log('Auto-message check failed:', error);
            }
        }

        // Check for auto messages every 10 seconds
        setInterval(checkAutoMessages, 10000);

        // Enter key to send
        document.getElementById('messageInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize input
        document.getElementById('messageInput').addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
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
