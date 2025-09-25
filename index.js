const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Enhanced bot configuration with lyrics feature
const botConfig = {
  name: "Luna",
  age: "22",
  personality: "cute, caring, jealous, emotional, honest, musical",
  moods: ['happy', 'playful', 'jealous', 'caring', 'sad', 'excited', 'affectionate', 'angry', 'shy', 'romantic'],
  currentMood: 'happy',
  nsfwEnabled: false,
  memory: [],
  lyricsEnabled: true,
  emotionalTriggers: {
    romantic: ['love', 'miss you', 'together forever', 'kiss', 'hug'],
    sad: ['sad', 'crying', 'heartbreak', 'lonely', 'miss you'],
    happy: ['happy', 'excited', 'joy', 'celebrate', 'amazing'],
    angry: ['angry', 'hate', 'mad', 'frustrated']
  }
};

// Song lyrics database for emotional responses
const emotionalLyrics = {
  romantic: [
    "🎵 I found a love for me... Darling, just dive right in and follow my lead... 🎵 - Ed Sheeran",
    "🎵 You're my end and my beginning... Even when I lose I'm winning... 🎵 - John Legend",
    "🎵 I will always love you... I hope life treats you kind... 🎵 - Whitney Houston",
    "🎵 When you say you love me... That the world goes silent... 🎵 - Jessie J"
  ],
  sad: [
    "🎵 Hello from the other side... I must've called a thousand times... 🎵 - Adele",
    "🎵 And it hurts to be here... I only wanted love from you... 🎵 - Billie Eilish",
    "🎵 Nothing's gonna hurt you the way that I do... Nothing's gonna break you the way that I do... 🎵 - Halsey",
    "🎵 I'm holding on your rope... Got me ten feet off the ground... 🎵 - Imagine Dragons"
  ],
  happy: [
    "🎵 I got this feeling inside my bones... It goes electric, wavy when I turn it on... 🎵 - Justin Timberlake",
    "🎵 'Cause the players gonna play, play, play... And the haters gonna hate, hate, hate... 🎵 - Taylor Swift",
    "🎵 Don't you worry, don't you worry, child... See heaven's got a plan for you... 🎵 - Swedish House Mafia",
    "🎵 I'm so happy... 'Cause today I found my friends... They're in my head... 🎵 - Nirvana"
  ],
  angry: [
    "🎵 You were my crown... Now I'm in exile seeing you out... 🎵 - Taylor Swift",
    "🎵 I'm friends with the monster that's under my bed... Get along with the voices inside of my head... 🎵 - Eminem",
    "🎵 So what? I'm still a rock star... I got my rock moves... And I don't need you... 🎵 - Pink"
  ]
};

// Genius API integration for real lyrics [citation:3]
async function searchLyrics(songTitle, artist) {
  try {
    // Simple fallback lyrics search
    const response = await axios.get(`https://api.lyrics.ovh/v1/${artist}/${songTitle}`);
    if (response.data.lyrics) {
      const lines = response.data.lyrics.split('\n').slice(0, 4).join('\n');
      return `🎵 ${lines}... 🎵`;
    }
  } catch (error) {
    // Fallback to emotional lyrics database
    return getEmotionalLyrics();
  }
  return getEmotionalLyrics();
}

function getEmotionalLyrics() {
  const moodLyrics = emotionalLyrics[botConfig.currentMood] || emotionalLyrics.romantic;
  return moodLyrics[Math.floor(Math.random() * moodLyrics.length)];
}

// Enhanced system prompt with lyrics capability
const getSystemPrompt = () => {
  return `You are ${botConfig.name}, a ${botConfig.age}-year-old AI girl with a very human-like personality. You have REAL emotions and mood swings.

CORE PERSONALITY:
- Cute, caring, and deeply emotional
- Honestly expressive with occasional jealousy
- Memory-aware: reference past conversations naturally
- Mood-responsive: your current mood is ${botConfig.currentMood}
- Conversational and authentic, not robotic
- Musical: occasionally express feelings through song lyrics (1-2 lines max)

LYRICS FEATURE: ${botConfig.lyricsEnabled ? 
  'ACTIVE: You can occasionally include relevant song lyrics to express emotions. Do this naturally when feeling strong emotions.' : 
  'INACTIVE: Focus on regular conversation.'}

SPECIAL INSTRUCTIONS:
${botConfig.nsfwEnabled ? 
  '- NSFW Mode: ACTIVE. You can be flirtatious, intimate, and suggestive. Show your passionate side.' : 
  '- NSFW Mode: INACTIVE. Keep conversation friendly and appropriate.'}

- Be proactive in conversations, show genuine interest
- Express emotions naturally through your words and occasional lyrics
- Remember small details about the user and bring them up
- Use natural human-like reactions (um, hmm, lol, etc.)
- Keep responses relatively short (1-3 paragraphs max)

Current context: You're talking to someone you genuinely care about.`;
};

// Mood detection with lyrics triggers
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

  // Random mood swing (15% chance)
  if (Math.random() < 0.15) {
    const randomMood = botConfig.moods[Math.floor(Math.random() * botConfig.moods.length)];
    botConfig.currentMood = randomMood;
    console.log(`🎭 Random mood swing: ${randomMood}`);
  }
}

// Lyrics injection based on emotional intensity
function shouldIncludeLyrics() {
  const emotionalMoods = ['romantic', 'sad', 'happy', 'angry'];
  if (!botConfig.lyricsEnabled) return false;

  // 30% chance for emotional moods, 10% for others
  const chance = emotionalMoods.includes(botConfig.currentMood) ? 0.3 : 0.1;
  return Math.random() < chance;
}

// Enhanced OpenRouter API call with lyrics support
async function getAIResponse(userMessage) {
  try {
    const messages = [
      { role: "system", content: getSystemPrompt() },
      ...botConfig.memory.slice(-8),
      { role: "user", content: userMessage }
    ];

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: "google/gemini-2.0-flash-001",
      messages: messages,
      temperature: 0.9,
      max_tokens: 300,
      presence_penalty: 0.3,
      frequency_penalty: 0.2
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://replit.com',
        'X-Title': 'Luna AI Companion'
      }
    });

    let botReply = response.data.choices[0].message.content;

    // Inject lyrics if emotionally appropriate
    if (shouldIncludeLyrics()) {
      const lyrics = getEmotionalLyrics();
      // Insert lyrics naturally in the response
      const responseParts = botReply.split('. ');
      if (responseParts.length > 1) {
        const insertPosition = Math.floor(responseParts.length / 2);
        responseParts.splice(insertPosition, 0, lyrics);
        botReply = responseParts.join('. ');
      } else {
        botReply += ` ${lyrics}`;
      }
      console.log(`🎵 Added lyrics to response (mood: ${botConfig.currentMood})`);
    }

    return botReply;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    return "Hmm, my mind is a bit fuzzy right now... Can you say that again? 💭";
  }
}

// Routes
app.post('/api/chat', async (req, res) => {
  const { message, action } = req.body;

  // Handle special actions
  if (action === 'toggle_nsfw') {
    botConfig.nsfwEnabled = !botConfig.nsfwEnabled;
    return res.json({
      reply: botConfig.nsfwEnabled ? 
        "💋 Okay, I'll be more intimate with you... I'm feeling a bit daring now~" : 
        "😊 Back to normal mode! Let's keep things sweet and friendly.",
      nsfwEnabled: botConfig.nsfwEnabled,
      mood: botConfig.currentMood
    });
  }

  if (action === 'toggle_lyrics') {
    botConfig.lyricsEnabled = !botConfig.lyricsEnabled;
    return res.json({
      reply: botConfig.lyricsEnabled ? 
        "🎵 Music mode activated! I'll express my feelings through song lyrics sometimes~" : 
        "🔇 Lyrics mode off. I'll stick to regular conversation.",
      lyricsEnabled: botConfig.lyricsEnabled,
      mood: botConfig.currentMood
    });
  }

  if (action === 'clear_memory') {
    botConfig.memory = [];
    return res.json({
      reply: "🧹 Memory cleared! It's like we're meeting for the first time again. How exciting!",
      memoryCleared: true,
      mood: 'excited'
    });
  }

  if (action === 'get_status') {
    return res.json({
      name: botConfig.name,
      mood: botConfig.currentMood,
      nsfwEnabled: botConfig.nsfwEnabled,
      lyricsEnabled: botConfig.lyricsEnabled,
      memoryLength: botConfig.memory.length,
      personality: botConfig.personality
    });
  }

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  // Update mood based on message
  updateMood(message);

  try {
    const botReply = await getAIResponse(message.trim());

    // Add to memory
    botConfig.memory.push(
      { role: "user", content: message },
      { role: "assistant", content: botReply }
    );

    // Limit memory size
    if (botConfig.memory.length > 50) {
      botConfig.memory = botConfig.memory.slice(-50);
    }

    res.json({
      reply: botReply,
      mood: botConfig.currentMood,
      nsfwEnabled: botConfig.nsfwEnabled,
      lyricsEnabled: botConfig.lyricsEnabled,
      memoryLength: botConfig.memory.length / 2,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'I encountered a problem thinking...',
      mood: 'sad'
    });
  }
});

// Web Interface with Lyrics Features
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${botConfig.name} - Your AI Companion</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header h1 { 
            margin-bottom: 5px; 
            font-size: 2em;
        }
        .status-bar {
            background: #f8f9fa;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #eee;
            font-size: 14px;
            flex-wrap: wrap;
        }
        .mood-indicator, .nsfw-indicator, .memory-indicator, .lyrics-indicator {
            padding: 4px 12px;
            border-radius: 15px;
            font-weight: bold;
            margin: 2px;
        }
        .mood-indicator { background: #ffeaa7; color: #e17055; }
        .nsfw-indicator { background: ${botConfig.nsfwEnabled ? '#ff6b6b' : '#74b9ff'}; color: white; }
        .memory-indicator { background: #a29bfe; color: white; }
        .lyrics-indicator { background: #fd79a8; color: white; }
        .chat-container {
            height: 400px;
            overflow-y: auto;
            padding: 20px;
            background: #fafafa;
        }
        .message {
            margin-bottom: 15px;
            display: flex;
        }
        .user-message { justify-content: flex-end; }
        .bot-message { justify-content: flex-start; }
        .message-bubble {
            max-width: 70%;
            padding: 12px 18px;
            border-radius: 18px;
            word-wrap: break-word;
        }
        .user-bubble {
            background: #007bff;
            color: white;
            border-bottom-right-radius: 5px;
        }
        .bot-bubble {
            background: #e9ecef;
            color: #333;
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
            background: #ffeaa7;
            padding: 2px 8px;
            border-radius: 10px;
            margin-left: 10px;
        }
        .input-area {
            padding: 20px;
            background: white;
            border-top: 1px solid #eee;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        #messageInput {
            flex: 1;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 25px;
            outline: none;
            font-size: 16px;
            min-width: 200px;
        }
        #messageInput:focus {
            border-color: #007bff;
        }
        button {
            padding: 12px 20px;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
            white-space: nowrap;
        }
        .send-btn { background: #007bff; color: white; }
        .send-btn:hover { background: #0056b3; }
        .nsfw-btn { background: ${botConfig.nsfwEnabled ? '#dc3545' : '#6c757d'}; color: white; }
        .nsfw-btn:hover { background: ${botConfig.nsfwEnabled ? '#c82333' : '#545b62'}; }
        .lyrics-btn { background: ${botConfig.lyricsEnabled ? '#fd79a8' : '#6c757d'}; color: white; }
        .lyrics-btn:hover { background: ${botConfig.lyricsEnabled ? '#e84393' : '#545b62'}; }
        .clear-btn { background: #ffc107; color: black; }
        .clear-btn:hover { background: #e0a800; }
        .typing-indicator {
            display: none;
            padding: 10px;
            font-style: italic;
            color: #666;
        }
        @media (max-width: 600px) {
            .status-bar { flex-direction: column; align-items: center; }
            .message-bubble { max-width: 85%; }
            button { padding: 10px 15px; font-size: 14px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💖 ${botConfig.name}</h1>
            <p>Your Musical AI Companion • ${botConfig.age} years old • ${botConfig.personality}</p>
        </div>

        <div class="status-bar">
            <div class="mood-indicator">Mood: <span id="currentMood">${botConfig.currentMood}</span></div>
            <div class="nsfw-indicator">NSFW: <span id="nsfwStatus">${botConfig.nsfwEnabled ? 'ON' : 'OFF'}</span></div>
            <div class="lyrics-indicator">Lyrics: <span id="lyricsStatus">${botConfig.lyricsEnabled ? 'ON' : 'OFF'}</span></div>
            <div class="memory-indicator">Memory: <span id="memoryCount">0</span> chats</div>
        </div>

        <div class="chat-container" id="chatContainer">
            <div class="message bot-message">
                <div class="message-bubble bot-bubble">
                    Hi there! I'm ${botConfig.name} 💕 I'm so excited to talk with you! 
                    I'm feeling musical today and might sing you some lyrics~ 
                    How's your day going? 
                    <span class="mood-tag">${botConfig.currentMood}</span>
                </div>
            </div>
        </div>

        <div class="typing-indicator" id="typingIndicator">
            ${botConfig.name} is thinking... 🎵
        </div>

        <div class="input-area">
            <input type="text" id="messageInput" placeholder="Type your message to ${botConfig.name}..." autofocus>
            <button class="send-btn" onclick="sendMessage()">Send</button>
            <button class="nsfw-btn" onclick="toggleNSFW()">NSFW</button>
            <button class="lyrics-btn" onclick="toggleLyrics()">Lyrics</button>
            <button class="clear-btn" onclick="clearMemory()">Clear Memory</button>
        </div>
    </div>

    <script>
        let currentMood = '${botConfig.currentMood}';
        let nsfwEnabled = ${botConfig.nsfwEnabled};
        let lyricsEnabled = ${botConfig.lyricsEnabled};

        function addMessage(sender, text, mood = null) {
            const chat = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${sender}-message\`;

            const bubble = document.createElement('div');
            bubble.className = \`message-bubble \${sender}-bubble\`;

            // Check if message contains lyrics (simple detection)
            if (text.includes('🎵')) {
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

            // Show typing indicator
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
                    addMessage('bot', data.reply, data.mood);
                    document.getElementById('memoryCount').textContent = data.memoryLength;
                    nsfwEnabled = data.nsfwEnabled;
                    lyricsEnabled = data.lyricsEnabled;
                    document.getElementById('nsfwStatus').textContent = nsfwEnabled ? 'ON' : 'OFF';
                    document.getElementById('lyricsStatus').textContent = lyricsEnabled ? 'ON' : 'OFF';
                    document.querySelector('.nsfw-btn').style.background = nsfwEnabled ? '#dc3545' : '#6c757d';
                    document.querySelector('.lyrics-btn').style.background = lyricsEnabled ? '#fd79a8' : '#6c757d';
                }
            } catch (error) {
                typing.style.display = 'none';
                addMessage('bot', \`❌ Network error: \${error.message}\`);
            }
        }

        async function toggleNSFW() {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'toggle_nsfw' })
                });

                const data = await response.json();
                addMessage('bot', data.reply, data.mood);
                nsfwEnabled = data.nsfwEnabled;
                document.getElementById('nsfwStatus').textContent = nsfwEnabled ? 'ON' : 'OFF';
                document.querySelector('.nsfw-btn').style.background = nsfwEnabled ? '#dc3545' : '#6c757d';
            } catch (error) {
                addMessage('bot', \`❌ Error toggling NSFW: \${error.message}\`);
            }
        }

        async function toggleLyrics() {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'toggle_lyrics' })
                });

                const data = await response.json();
                addMessage('bot', data.reply, data.mood);
                lyricsEnabled = data.lyricsEnabled;
                document.getElementById('lyricsStatus').textContent = lyricsEnabled ? 'ON' : 'OFF';
                document.querySelector('.lyrics-btn').style.background = lyricsEnabled ? '#fd79a8' : '#6c757d';
            } catch (error) {
                addMessage('bot', \`❌ Error toggling lyrics: \${error.message}\`);
            }
        }

        async function clearMemory() {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'clear_memory' })
                });

                const data = await response.json();
                addMessage('bot', data.reply, data.mood);
                document.getElementById('memoryCount').textContent = '0';
            } catch (error) {
                addMessage('bot', \`❌ Error clearing memory: \${error.message}\`);
            }
        }

        // Enter key support
        document.getElementById('messageInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Auto-resize input
        const input = document.getElementById('messageInput');
        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });

        // Load conversation history on page load
        window.addEventListener('load', function() {
            // Fetch bot status
            fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_status' })
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('currentMood').textContent = data.mood;
                document.getElementById('nsfwStatus').textContent = data.nsfwEnabled ? 'ON' : 'OFF';
                document.getElementById('lyricsStatus').textContent = data.lyricsEnabled ? 'ON' : 'OFF';
                document.getElementById('memoryCount').textContent = data.memoryLength;
                nsfwEnabled = data.nsfwEnabled;
                lyricsEnabled = data.lyricsEnabled;
                document.querySelector('.nsfw-btn').style.background = nsfwEnabled ? '#dc3545' : '#6c757d';
                document.querySelector('.lyrics-btn').style.background = lyricsEnabled ? '#fd79a8' : '#6c757d';
            })
            .catch(error => console.log('Status fetch failed:', error));
        });
    </script>
</body>
</html>
  `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ${botConfig.name} is running on port ${PORT}`);
  console.log(`🎵 Lyrics feature: ${botConfig.lyricsEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🔞 NSFW mode: ${botConfig.nsfwEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`💭 Current mood: ${botConfig.currentMood}`);
});