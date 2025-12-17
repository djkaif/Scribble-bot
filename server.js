const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TOKEN;
const BASE_URL = "https://scribble-bot.onrender.com";

// ---------- HELPERS ----------
function getRandomWord() {
    const words = fs.readFileSync("words.txt", "utf8")
        .split(/\r?\n/)
        .filter(Boolean);
    return words[Math.floor(Math.random() * words.length)].toLowerCase();
}

function generateCode() {
    return crypto.randomBytes(3).toString("hex");
}

// ---------- DISCORD BOT ----------
const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const activeGames = new Map();
/*
gameId: {
  channelId,
  word,
  drawerId,
  randomDrawer,
  players: Map<code, { id, tag, display }>
}
*/

bot.on("messageCreate", async (message) => {
    if (!message.content.startsWith("!start")) return;

    const args = message.content.split(" ");
    const randomMode = args[0] === "!start.ran";
    const mentioned = message.mentions.users.first();

    if (!randomMode && !mentioned) {
        return message.reply("Usage: `!start @user` or `!start.ran`");
    }

    const gameId = crypto.randomUUID();
    const word = getRandomWord();

    activeGames.set(gameId, {
        channelId: message.channel.id,
        word,
        drawerId: randomMode ? null : mentioned.id,
        randomDrawer: randomMode,
        players: new Map()
    });

    const embed = new EmbedBuilder()
        .setTitle("🎨 Scribble Game Started")
        .setDescription(
            `🖌️ Drawer: **${randomMode ? "Random" : mentioned.tag}**  
🎮 React with ✏️ to get a join code  
🔗 **[Open Game](${BASE_URL}/?room=${gameId})**`
        )
        .setColor(0x5865F2);

    const gameMsg = await message.channel.send({ embeds: [embed] });
    await gameMsg.react("✏️");

    const filter = (reaction, user) =>
        reaction.emoji.name === "✏️" && !user.bot;

    const collector = gameMsg.createReactionCollector({ filter });

    collector.on("collect", async (_, user) => {
        const game = activeGames.get(gameId);
        if (!game) return;

        for (const p of game.players.values()) {
            if (p.id === user.id) return;
        }

        const code = generateCode();

        game.players.set(code, {
            id: user.id,
            tag: user.username,
            display: user.globalName || user.username
        });

        await user.send(
            `🎨 **Scribble Game Code**  
Room: **${gameId}**  
Code: **${code}**  
Link: ${BASE_URL}/?room=${gameId}`
        );

        if (game.randomDrawer && !game.drawerId) {
            game.drawerId = user.id;
        }
    });
});

// ---------- WEB SERVER ----------
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
    socket.on("join", ({ room, code }) => {
        const game = activeGames.get(room);
        if (!game) return;

        const player = game.players.get(code);
        if (!player) return;

        socket.data.room = room;
        socket.data.player = player;
        socket.join(room);

        socket.emit("role", {
            drawer: player.id === game.drawerId,
            name: `${player.display} (@${player.tag})`
        });
    });

    socket.on("startPath", (p) => {
        socket.to(socket.data.room).emit("startPath", p);
    });

    socket.on("draw", (p) => {
        socket.to(socket.data.room).emit("draw", p);
    });

    socket.on("endPath", () => {
        socket.to(socket.data.room).emit("endPath");
    });

    socket.on("chat", (msg) => {
        const game = activeGames.get(socket.data.room);
        if (!game) return;

        if (
            socket.data.player.id !== game.drawerId &&
            msg.trim().toLowerCase() === game.word
        ) {
            io.to(socket.data.room).emit("system", {
                text: `🎉 ${socket.data.player.display} guessed the word!`
            });

            const channel = bot.channels.cache.get(game.channelId);
            channel?.send(
                `🏆 **${socket.data.player.display}** guessed **${game.word.toUpperCase()}**`
            );

            game.word = getRandomWord();
        } else {
            io.to(socket.data.room).emit("chat", {
                user: socket.data.player.display,
                text: msg
            });
        }
    });
});

server.listen(PORT, () => {
    bot.login(TOKEN);
    console.log("Server running");
});
