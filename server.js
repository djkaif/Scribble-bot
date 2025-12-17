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

const ROUND_TIME = 90;
const HINT_INTERVAL = 30;
const JOIN_COOLDOWN = 60_000;

function getRandomWord() {
    return fs.readFileSync("words.txt", "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        [Math.floor(Math.random() * 50)]
        .toLowerCase();
}

function generateCode() {
    return crypto.randomBytes(3).toString("hex");
}

function maskWord(word, revealed) {
    return word.split("").map((c, i) =>
        revealed.has(i) ? c : "_"
    ).join(" ");
}

const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const games = new Map();
const cooldown = new Map();

bot.on("messageCreate", async message => {
    if (!message.content.startsWith("!start")) return;

    const random = message.content.startsWith("!start.ran");
    const mentioned = message.mentions.users.first();
    if (!random && !mentioned) {
        return message.reply("Use `!start @user` or `!start.ran`");
    }

    const gameId = crypto.randomUUID();
    const word = getRandomWord();

    games.set(gameId, {
        channelId: message.channel.id,
        word,
        revealed: new Set(),
        drawerId: random ? null : mentioned.id,
        players: new Map(),
        votes: new Set(),
        timeLeft: ROUND_TIME
    });

    const embed = new EmbedBuilder()
        .setTitle("🎨 Scribble Game Started")
        .setDescription(
            `🖌️ Drawer: **${random ? "Random" : mentioned.tag}**
⏱️ Round: **${ROUND_TIME}s**
🎮 React ✏️ to get a code
🔗 [Join Game](${BASE_URL}/?room=${gameId})`
        )
        .setColor(0x5865F2);

    const msg = await message.channel.send({ embeds: [embed] });
    await msg.react("✏️");

    const collector = msg.createReactionCollector({
        filter: (r, u) => r.emoji.name === "✏️" && !u.bot
    });

    collector.on("collect", async (_, user) => {
        const last = cooldown.get(user.id) || 0;
        if (Date.now() - last < JOIN_COOLDOWN) return;
        cooldown.set(user.id, Date.now());

        const game = games.get(gameId);
        if (!game) return;

        if (![...game.players.values()].find(p => p.id === user.id)) {
            const code = generateCode();
            game.players.set(code, {
                id: user.id,
                name: user.globalName || user.username,
                tag: user.username
            });

            if (!game.drawerId) game.drawerId = user.id;

            const temp = await message.channel.send(
`🎟️ ${user}
Room: ${gameId}
Code:
\`\`\`
${code}
\`\`\`
${BASE_URL}/?room=${gameId}`
            );

            setTimeout(() => temp.delete().catch(() => {}), 30_000);
        }
    });
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", socket => {
    socket.on("join", ({ room, code }) => {
        const game = games.get(room);
        if (!game) return;

        const player = game.players.get(code);
        if (!player) return;

        socket.data.room = room;
        socket.data.player = player;
        socket.join(room);

        socket.emit("init", {
            drawer: player.id === game.drawerId,
            players: [...game.players.values()],
            time: game.timeLeft
        });

        io.to(room).emit("players", [...game.players.values()]);
    });

    socket.on("voteSkip", () => {
        const game = games.get(socket.data.room);
        if (!game) return;

        if (socket.data.player.id === game.drawerId) return;
        game.votes.add(socket.data.player.id);

        const needed = Math.ceil((game.players.size - 1) / 2);
        if (game.votes.size >= needed) {
            nextRound(socket.data.room);
        }
    });

    socket.on("startPath", p => socket.to(socket.data.room).emit("startPath", p));
    socket.on("draw", p => socket.to(socket.data.room).emit("draw", p));
    socket.on("endPath", () => socket.to(socket.data.room).emit("endPath"));

    socket.on("chat", msg => {
        const game = games.get(socket.data.room);
        if (!game) return;

        if (
            socket.data.player.id !== game.drawerId &&
            msg.trim().toLowerCase() === game.word
        ) {
            io.to(socket.data.room).emit("system", {
                text: `🎉 ${socket.data.player.name} guessed the word!`
            });
            nextRound(socket.data.room);
        } else {
            io.to(socket.data.room).emit("chat", {
                user: socket.data.player.name,
                text: msg
            });
        }
    });
});

function nextRound(room) {
    const game = games.get(room);
    if (!game) return;

    game.word = getRandomWord();
    game.revealed.clear();
    game.votes.clear();
    game.timeLeft = ROUND_TIME;

    io.to(room).emit("round");
}

setInterval(() => {
    for (const [room, game] of games) {
        game.timeLeft--;
        io.to(room).emit("timer", game.timeLeft);

        if (game.timeLeft % HINT_INTERVAL === 0) {
            const hidden = [...game.word].map((_, i) => i)
                .filter(i => !game.revealed.has(i));
            if (hidden.length) {
                game.revealed.add(hidden[Math.floor(Math.random() * hidden.length)]);
                io.to(room).emit("hint", maskWord(game.word, game.revealed));
            }
        }

        if (game.timeLeft <= 0) nextRound(room);
    }
}, 1000);

server.listen(PORT, () => {
    bot.login(TOKEN);
    console.log("Scribble Bot v2.2 running");
});
