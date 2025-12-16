const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TOKEN;

// --- WORD SYSTEM ---
function getRandomWord() {
    try {
        const data = fs.readFileSync('words.txt', 'utf8');
        const lines = data.split(/\r?\n/).filter(line => line.trim() !== "");
        return lines[Math.floor(Math.random() * lines.length)].toLowerCase();
    } catch (err) {
        return "apple"; // Fallback
    }
}

const bot = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const activeGames = new Map(); // { gameId: { channelId, word } }
const leaderboard = new Map();

bot.on('messageCreate', async (message) => {
    if (message.content === '!start') {
        const gameId = Math.random().toString(36).substring(7);
        const secretWord = getRandomWord();
        
        activeGames.set(gameId, { channelId: message.channel.id, word: secretWord });
        
        const gameLink = `https://scribble-bot.onrender.com/?room=${gameId}`;
        const embed = new EmbedBuilder()
            .setTitle('🎨 New Game Started!')
            .setDescription(`Click to Join: **[Join Room](${gameLink})**\n*Hint: The word is hidden!*`)
            .setColor('#00ff00');
            
        await message.channel.send({ embeds: [embed] });
    }
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ room, username }) => {
        socket.join(room);
        socket.data.username = username;
        socket.data.room = room;
        console.log(`${username} joined ${room}`);
    });

    socket.on('draw', (data) => socket.to(socket.data.room).emit('draw', data));
    socket.on('clearCanvas', () => io.to(socket.data.room).emit('clearCanvas'));

    socket.on('chatMessage', (msg) => {
        const room = socket.data.room;
        const game = activeGames.get(room);
        
        if (game && msg.toLowerCase().includes(game.word)) {
            io.to(room).emit('chatMessage', { user: 'System', text: `🎉 ${socket.data.username} guessed it! The word was ${game.word.toUpperCase()}!` });
            
            const channel = bot.channels.cache.get(game.channelId);
            if (channel) {
                const score = (leaderboard.get(socket.data.username) || 0) + 10;
                leaderboard.set(socket.data.username, score);
                channel.send(`🏆 **${socket.data.username}** guessed **${game.word.toUpperCase()}**!`);
            }
            // Pick a new word for the same room
            game.word = getRandomWord();
        } else {
            io.to(room).emit('chatMessage', { user: socket.data.username, text: msg });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Live on ${PORT}`);
    bot.login(TOKEN);
});
