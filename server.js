const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// --- CONFIGURATION ---
// Render provides the PORT automatically, or defaults to 3000
const PORT = process.env.PORT || 3000; 
const TOKEN = process.env.TOKEN;

// --- DISCORD BOT SETUP ---
const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Store active games: { gameId: channelId }
const activeGames = new Map();
// Simple Leaderboard: { username: score }
const leaderboard = new Map();

bot.once('ready', () => {
    console.log(`🤖 Bot is ready as ${bot.user.tag}`);
});

bot.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!start') {
        const gameId = Math.random().toString(36).substring(7);
        activeGames.set(gameId, message.channel.id);
        
        // --- UPDATED LINK FOR RENDER ---
        const gameLink = `https://scribble-bot.onrender.com/?room=${gameId}`;
        
        const embed = new EmbedBuilder()
            .setTitle('🎨 Scribble Time!')
            .setDescription(`Click here to join the game: **[Join Room](${gameLink})**`)
            .setColor('#0099ff');
            
        await message.channel.send({ embeds: [embed] });
    }

    if (message.content === '!leaderboard') {
        let text = "**🏆 Leaderboard 🏆**\n";
        if (leaderboard.size === 0) text += "No scores yet!";
        
        // Sort and display
        const sorted = [...leaderboard.entries()].sort((a, b) => b[1] - a[1]);
        sorted.forEach(([user, score], index) => {
            text += `${index + 1}. **${user}**: ${score} pts\n`;
        });
        
        message.channel.send(text);
    }
});

// --- WEB SERVER & SOCKET.IO SETUP ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (HTML/CSS/JS) from 'public' folder
app.use(express.static('public'));

io.on('connection', (socket) => {
    // User joins a specific room
    socket.on('joinRoom', ({ room, username }) => {
        socket.join(room);
        socket.data.username = username;
        socket.data.room = room;
        console.log(`${username} joined room ${room}`);
        
        // Broadcast that a user joined
        io.to(room).emit('chatMessage', { user: 'System', text: `${username} has joined!` });
    });

    // Handle Drawing Data
    socket.on('draw', (data) => {
        // Broadcast drawing to everyone else in the room
        socket.to(socket.data.room).emit('draw', data);
    });

    // Handle Clears
    socket.on('clearCanvas', () => {
        io.to(socket.data.room).emit('clearCanvas');
    });

    // Handle Guesses/Chat
    socket.on('chatMessage', (msg) => {
        const room = socket.data.room;
        
        // Check if they guessed the secret word "apple" (Hardcoded for this test)
        if (msg.toLowerCase().includes('apple')) {
            io.to(room).emit('chatMessage', { user: 'System', text: `🎉 ${socket.data.username} guessed the word (APPLE)!` });
            
            // --- UPDATE DISCORD ---
            const discordChannelId = activeGames.get(room);
            if (discordChannelId) {
                const channel = bot.channels.cache.get(discordChannelId);
                if (channel) {
                    // Update leaderboard
                    const currentScore = leaderboard.get(socket.data.username) || 0;
                    leaderboard.set(socket.data.username, currentScore + 10);
                    
                    channel.send(`🎉 **${socket.data.username}** won a round in the web game! They guessed **APPLE**! (+10 pts)`);
                }
            }
        } else {
            // Normal chat message
            io.to(room).emit('chatMessage', { user: socket.data.username, text: msg });
        }
    });
});

// Start Server & Bot
server.listen(PORT, () => {
    console.log(`🌐 Web Server running on port ${PORT}`);
    bot.login(TOKEN);
});
