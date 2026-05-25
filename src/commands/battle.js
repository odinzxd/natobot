import { SlashCommandBuilder } from 'discord.js';
import { ensureUser } from '../services/users.js';
import { runBattle } from '../services/battles.js';

export const data = new SlashCommandBuilder()
  .setName('battle')
  .setDescription('Utfordre en annen spiller til troppkamp.')
  .addUserOption((option) => option.setName('user').setDescription('Motstander').setRequired(true));

export async function execute(interaction) {
  const opponentDiscord = interaction.options.getUser('user');
  if (opponentDiscord.bot || opponentDiscord.id === interaction.user.id) {
    await interaction.reply({ content: 'Velg en ekte motstander, ikke deg selv eller en bot.', ephemeral: true });
    return;
  }
  const challenger = await ensureUser(interaction.user);
  const opponent = await ensureUser(opponentDiscord);
  const embed = await runBattle(challenger, opponent);
  await interaction.reply({ embeds: [embed] });
}
