
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

// Enhanced Web Interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${botConfig.name} - Your AI Companion</title>
    <style>
        :root {
            --primary-color: #667eea;
            --secondary-color: #764ba2;
            --accent-color: #ff6b6b;
            --text-light: #ffffff;
            --bg-light: #fafafa;
            --bg-dark: #1a1a1a;
            --chat-bg-light: #ffffff;
            --chat-bg-dark: #2d2d2d;
            --user-bubble-light: #007bff;
            --user-bubble-dark: #0056b3;
            --bot-bubble-light: #e9ecef;
            --bot-bubble-dark: #404040;
            --text-dark: #333333;
            --text-light-mode: #ffffff;
        }

        [data-theme="dark"] {
            --bg-light: var(--bg-dark);
            --chat-bg-light: var(--chat-bg-dark);
            --bot-bubble-light: var(--bot-bubble-dark);
            --text-dark: var(--text-light-mode);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            min-height: 100vh;
            padding: 20px;
            transition: all 0.3s ease;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: var(--chat-bg-light);
            border-radius: 20px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.2);
            overflow: hidden;
            transition: all 0.3s ease;
        }
        
        .header {
            background: linear-gradient(135deg, var(--accent-color) 0%, #ee5a52 100%);
            color: white;
            padding: 25px;
            text-align: center;
            position: relative;
        }
        
        .header h1 { 
            margin-bottom: 8px; 
            font-size: 2.2em;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1.1em;
        }
        
        .theme-toggle {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255,255,255,0.2);
            border: none;
            padding: 10px;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .theme-toggle:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.1);
        }
        
        .status-bar {
            background: var(--bg-light);
            color: var(--text-dark);
            padding: 15px 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #eee;
            font-size: 14px;
            flex-wrap: wrap;
        }
        
        .mood-indicator {
            padding: 6px 15px;
            border-radius: 20px;
            font-weight: bold;
            background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
            color: #e17055;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        .online-indicator {
            padding: 6px 15px;
            border-radius: 20px;
            background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
            color: white;
            font-weight: bold;
        }
        
        .chat-container {
            height: 450px;
            overflow-y: auto;
            padding: 25px;
            background: var(--bg-light);
            scroll-behavior: smooth;
        }
        
        .message {
            margin-bottom: 20px;
            display: flex;
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .user-message { justify-content: flex-end; }
        .bot-message { justify-content: flex-start; }
        
        .message-bubble {
            max-width: 75%;
            padding: 15px 20px;
            border-radius: 20px;
            word-wrap: break-word;
            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        
        .message-bubble:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.15);
        }
        
        .user-bubble {
            background: linear-gradient(135deg, var(--user-bubble-light) 0%, var(--user-bubble-dark) 100%);
            color: white;
            border-bottom-right-radius: 5px;
        }
        
        .bot-bubble {
            background: var(--bot-bubble-light);
            color: var(--text-dark);
            border-bottom-left-radius: 5px;
        }
        
        .lyrics-bubble {
            background: linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%);
            color: white;
            font-style: italic;
            border-left: 4px solid #e84393;
        }
        
        .mood-tag {
            font-size: 11px;
            background: rgba(255,255,255,0.2);
            padding: 3px 8px;
            border-radius: 12px;
            margin-left: 10px;
            display: inline-block;
        }
        
        .input-area {
            padding: 25px;
            background: var(--chat-bg-light);
            border-top: 1px solid #eee;
            display: flex;
            gap: 15px;
            align-items: center;
        }
        
        #messageInput {
            flex: 1;
            padding: 15px 20px;
            border: 2px solid #ddd;
            border-radius: 30px;
            outline: none;
            font-size: 16px;
            transition: all 0.3s ease;
            background: var(--bg-light);
            color: var(--text-dark);
        }
        
        #messageInput:focus {
            border-color: var(--primary-color);
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
        }
        
        .send-btn {
            padding: 15px 25px;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            color: white;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
        }
        
        .send-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }
        
        .send-btn:active {
            transform: translateY(0);
        }
        
        .typing-indicator {
            display: none;
            padding: 15px 25px;
            font-style: italic;
            color: #666;
            background: var(--bg-light);
        }
        
        .typing-dots {
            display: inline-block;
        }
        
        .typing-dots span {
            animation: typing 1.4s infinite;
            animation-fill-mode: both;
        }
        
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-10px); }
        }
        
        @media (max-width: 600px) {
            .container { margin: 10px; border-radius: 15px; }
            .header { padding: 20px; }
            .header h1 { font-size: 1.8em; }
            .status-bar { flex-direction: column; gap: 10px; }
            .message-bubble { max-width: 90%; }
            .input-area { flex-direction: column; }
            #messageInput { width: 100%; }
        }
    </style>
</head>
<body data-theme="light">
    <div class="container">
        <div class="header">
            <button class="theme-toggle" onclick="toggleTheme()">🌙</button>
            <h1>💖 ${botConfig.name}</h1>
            <p>Your Musical AI Companion • ${botConfig.age} years old • Always here for you</p>
        </div>

        <div class="status-bar">
            <div class="mood-indicator">✨ <span id="currentMood">${botConfig.currentMood}</span></div>
            <div class="online-indicator">💚 Online & Ready</div>
        </div>

        <div class="chat-container" id="chatContainer">
            <div class="message bot-message">
                <div class="message-bubble bot-bubble">
                    Hi there! I'm ${botConfig.name} 💕
                </div>
            </div>
            <div class="message bot-message">
                <div class="message-bubble bot-bubble">
                    I'm so excited to talk with you!
                </div>
            </div>
            <div class="message bot-message">
                <div class="message-bubble bot-bubble lyrics-bubble">
                    🎵 I'm feeling good today... ready to share my heart with you... 🎵
                    <span class="mood-tag">${botConfig.currentMood}</span>
                </div>
            </div>
        </div>

        <div class="typing-indicator" id="typingIndicator">
            ${botConfig.name} is typing<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
        </div>

        <div class="input-area">
            <input type="text" id="messageInput" placeholder="Type your message to ${botConfig.name}..." autofocus>
            <button class="send-btn" onclick="sendMessage()">Send 💕</button>
        </div>
    </div>

    <script>
        let currentMood = '${botConfig.currentMood}';
        
        function toggleTheme() {
            const body = document.body;
            const button = document.querySelector('.theme-toggle');
            
            if (body.getAttribute('data-theme') === 'light') {
                body.setAttribute('data-theme', 'dark');
                button.textContent = '☀️';
            } else {
                body.setAttribute('data-theme', 'light');
                button.textContent = '🌙';
            }
        }

        function addMessage(sender, text, mood = null, isLyrics = false) {
            const chat = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${sender}-message\`;

            const bubble = document.createElement('div');
            bubble.className = \`message-bubble \${sender}-bubble\`;

            if (isLyrics || text.includes('🎵')) {
                bubble.classList.add('lyrics-bubble');
            }

            bubble.innerHTML = text;

            if (mood && sender === 'bot') {
                const moodTag = document.createElement('span');
                moodTag.className = 'mood-tag';
                moodTag.textContent = mood;
                bubble.appendChild(moodTag);
                currentMood = mood;
                document.getElementById('currentMood').textContent = mood;
            }

            messageDiv.appendChild(bubble);
            chat.appendChild(messageDiv);
            chat.scrollTop = chat.scrollHeight;
        }

        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            if (!message) return;

            addMessage('user', message);
            input.value = '';

            const typing = document.getElementById('typingIndicator');
            typing.style.display = 'block';
            document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight;

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: message })
                });

                const data = await response.json();
                typing.style.display = 'none';

                if (data.error) {
                    addMessage('bot', \`❌ Error: \${data.error}\`);
                } else {
                    // Add messages with delays for realistic effect
                    for (let i = 0; i < data.messages.length; i++) {
                        setTimeout(() => {
                            const isLyrics = data.messages[i].includes('🎵');
                            addMessage('bot', data.messages[i], i === 0 ? data.mood : null, isLyrics);
                        }, i * 800);
                    }
                }
            } catch (error) {
                typing.style.display = 'none';
                addMessage('bot', \`❌ Network error: \${error.message}\`);
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
                            addMessage('bot', data.messages[i], data.mood);
                        }, i * 1000);
                    }
                }
            } catch (error) {
                console.log('Auto-message check failed:', error);
            }
        }

        // Check for auto messages every 10 seconds
        setInterval(checkAutoMessages, 10000);

        document.getElementById('messageInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
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
