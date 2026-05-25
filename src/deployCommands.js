import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { commands } from './commands/index.js';

export async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const payload = commands.map((command) => command.data.toJSON());
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: payload });
    console.log(`[discord] Registered ${payload.length} guild slash commands`);
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body: payload });
    console.log(`[discord] Registered ${payload.length} global slash commands`);
  }
}
