import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes, MessageFlags } from "discord.js";
import { REST } from "@discordjs/rest";

export function startDiscordBot(gameManager, codeManager) {
  const bot = new Client({ 
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages, 
      GatewayIntentBits.GuildMessageReactions // ✅ Needed to detect reactions
    ] 
  });

  const commands = [
    new SlashCommandBuilder()
      .setName("start")
      .setDescription("Start a Scribble game that others can join")
      .addUserOption(opt => opt.setName("drawer").setDescription("The first drawer (optional)"))
  ].map(cmd => cmd.toJSON());

  bot.once("ready", async () => {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
      await rest.put(Routes.applicationCommands(bot.user.id), { body: commands });
      console.log("✅ Slash commands registered");
    } catch (e) { console.error(e); }
  });

  bot.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "start") {
      // ✅ 1. Public Defer (Everyone can see this message)
      await interaction.deferReply(); 

      try {
        const drawer = interaction.options.getUser("drawer");
        const game = gameManager.createGame({
          channelId: interaction.channelId,
          drawerId: drawer ? drawer.id : null
        });

        const embed = new EmbedBuilder()
          .setTitle("🎨 Scribble Room Ready!")
          .setDescription(
            `**Host:** ${interaction.user.username}\n` +
            `**Drawer:** ${drawer ? drawer.username : "Random"}\n\n` +
            `1️⃣ **[Click Here to Open Game](${gameManager.baseUrl}/?room=${game.id})**\n` +
            `2️⃣ React with ✏️ to get your **Private Join Code** via DM.`
          )
          .setFooter({ text: "Codes expire in 3 minutes" })
          .setColor(0x5865f2);

        // ✅ 2. Send the public message and get the message object
        const message = await interaction.editReply({
          embeds: [embed],
          fetchReply: true 
        });

        // ✅ 3. Add the reaction emoji
        await message.react("✏️");

        // ✅ 4. Create a collector for the ✏️ emoji
        const collector = message.createReactionCollector({
          filter: (r, u) => r.emoji.name === "✏️" && !u.bot,
          time: 600000 // 10 minutes
        });

        collector.on("collect", async (reaction, user) => {
          const displayName = user.globalName || user.username;
          const res = codeManager.issueCode(user.id, game.id, displayName);

          if (!res.ok) {
            // If they are on cooldown, tell them privately
            return user.send(`❌ **Error:** ${res.reason}`).catch(() => null);
          }

          // ✅ 5. Send the code PRIVATELY to the person who reacted
          try {
            await user.send(
              `🎟 **Your Scribble Join Code:** \`${res.code}\`\n` +
              `Enter this code on the website to join the room!`
            );
          } catch (err) {
            // If their DMs are closed, mention them in the channel briefly
            interaction.channel.send(`⚠️ <@${user.id}>, I couldn't DM you your code! Please open your DMs.`)
              .then(m => setTimeout(() => m.delete(), 5000));
          }
        });

      } catch (error) {
        console.error(error);
        await interaction.editReply({ content: "Error starting game." });
      }
    }
  });

  bot.login(process.env.TOKEN);
}
