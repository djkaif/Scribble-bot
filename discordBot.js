import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes, MessageFlags } from "discord.js";
import { REST } from "@discordjs/rest";

export function startDiscordBot(gameManager, codeManager) {
  const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

  const commands = [
    new SlashCommandBuilder()
      .setName("start")
      .setDescription("Create a new Scribble game")
      .addUserOption(opt => 
        opt.setName("drawer")
           .setDescription("Select who draws first (optional)")
      )
  ].map(cmd => cmd.toJSON());

  bot.once("ready", async () => {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
      await rest.put(Routes.applicationCommands(bot.user.id), { body: commands });
      console.log("✅ Slash commands registered");
    } catch (e) { 
      console.error("Error registering commands:", e); 
    }
  });

  bot.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "start") {
      // ✅ 1. Immediately defer the reply. This stops the "Unknown Interaction" error.
      // We set it to Ephemeral so the "Bot is thinking..." is also private.
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      try {
        const drawer = interaction.options.getUser("drawer");
        
        // 2. Run your game logic
        const game = gameManager.createGame({
          channelId: interaction.channelId,
          drawerId: drawer ? drawer.id : null
        });

        const displayName = interaction.user.globalName || interaction.user.username;
        const res = codeManager.issueCode(interaction.user.id, game.id, displayName);

        if (!res.ok) {
          return interaction.editReply({ content: res.reason });
        }

        const unix = Math.floor(res.expiresAt / 1000);

        const embed = new EmbedBuilder()
          .setTitle("🎨 Scribble Room Created")
          .setDescription(
            `Channel: <#${interaction.channelId}>\n` +
            `Drawer: **${drawer ? drawer.username : "Random"}**\n\n` +
            `Click the link and enter your code on the website.`
          )
          .setColor(0x5865f2);

        // ✅ 3. Use editReply instead of reply because we deferred.
        await interaction.editReply({
          content: `🎟 **PRIVATE ACCESS**\n` +
                   `Code: \`${res.code}\`\n` +
                   `Expires: <t:${unix}:R>\n` +
                   `Link: ${gameManager.baseUrl}/?room=${game.id}`,
          embeds: [embed]
        });
      } catch (error) {
        console.error("Error processing /start:", error);
        await interaction.editReply({ content: "There was an error starting the game." });
      }
    }
  });

  bot.login(process.env.TOKEN);
}
