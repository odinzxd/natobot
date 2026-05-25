import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import { assertConfig, config } from './config.js';
import { initDatabase } from './database/init.js';
import { commandMap } from './commands/index.js';
import { deployCommands } from './deployCommands.js';

assertConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection(commandMap);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[discord] Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (interaction.isAutocomplete()) {
    try {
      if (command.autocomplete) {
        await command.autocomplete(interaction);
      }
    } catch (error) {
      console.error(`[autocomplete] ${interaction.commandName} failed:`, error);
      if (!interaction.responded) await interaction.respond([]);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const originalReply = interaction.reply.bind(interaction);
  const originalFollowUp = interaction.followUp.bind(interaction);
  const originalDeferReply = interaction.deferReply.bind(interaction);
  let deferTimer;

  interaction.reply = async (options) => {
    clearTimeout(deferTimer);
    if (interaction.deferred) {
      if (typeof options === 'object' && options !== null && 'ephemeral' in options) {
        const { ephemeral, ...editOptions } = options;
        return interaction.editReply(editOptions);
      }
      return interaction.editReply(options);
    }
    if (interaction.replied) return originalFollowUp(options);
    return originalReply(options);
  };

  try {
    deferTimer = setTimeout(() => {
      if (!interaction.deferred && !interaction.replied) {
        originalDeferReply().catch((error) => console.error(`[command] Failed to defer ${interaction.commandName}:`, error));
      }
    }, 2000);
    await command.execute(interaction);
    clearTimeout(deferTimer);
  } catch (error) {
    clearTimeout(deferTimer);
    console.error(`[command] ${interaction.commandName} failed:`, error);
    const message = error.message || 'Noe gikk galt. Prøv igjen senere.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
});

async function main() {
  console.log('[boot] Starting Natobot');
  await initDatabase();
  await deployCommands();
  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error('[boot] Fatal startup error:', error);
  process.exit(1);
});
