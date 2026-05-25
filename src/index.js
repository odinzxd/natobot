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
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
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
