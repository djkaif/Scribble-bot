import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { createCodeManager } from "./game/codeManager.js";
import { RULES } from "./game/constants.js";

export function startDiscordBot(gameManager) {
  const bot = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions
    ]
  });

  const codeManager = createCodeManager();

  bot.on("messageCreate", async msg => {
    if (!msg.content.startsWith("!start")) return;

    const random = msg.content.startsWith("!start.ran");
    const mentioned = msg.mentions.users.first();
    if (!random && !mentioned)
      return msg.reply("Use `!start @user` or `!start.ran`");

    const game = gameManager.createGame({
      channelId: msg.channel.id,
      drawerId: random ? null : mentioned.id
    });

    const embed = new EmbedBuilder()
      .setTitle("🎨 Scribble Game")
      .setDescription(
        `Drawer: **${random ? "Random" : mentioned.tag}**\n` +
        `Max Players: ${RULES.MAX_PLAYERS}\n` +
        `Code Expires: 3 minutes\n\n` +
        `React ✏️ to get a join code`
      )
      .setColor(0x5865f2);

    const m = await msg.channel.send({ embeds: [embed] });
    await m.react("✏️");

    const collector = m.createReactionCollector({
      filter: (r, u) => r.emoji.name === "✏️" && !u.bot
    });

    collector.on("collect", (_, user) => {
      const res = codeManager.issueCode(user.id, game.id);
      if (!res.ok) {
        msg.channel.send(`<@${user.id}> ${res.reason}`)
          .then(m => setTimeout(() => m.delete(), 5000));
        return;
      }

      // ✅ Convert milliseconds → seconds ONLY for Discord timestamp
      const unix = Math.floor(res.expiresAt / 1000);

      msg.channel.send(
        `🎟 <@${user.id}>\n` +
        `Expires: <t:${unix}:R>\n\n` +
        `\`\`\`${res.code}\`\`\`\n` +
        `${gameManager.baseUrl}/?room=${game.id}`
      ).then(m => setTimeout(() => m.delete(), 30000));
    });
  });

  bot.login(process.env.TOKEN);
}
