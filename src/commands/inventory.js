import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ensureUser } from '../services/users.js';
import { getInventory } from '../services/cards.js';
import { formatCardLine } from '../utils/format.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Vis kortene dine.')
  .addIntegerOption((option) => option.setName('page').setDescription('Side').setMinValue(1));

export async function execute(interaction) {
  const user = await ensureUser(interaction.user);
  const page = interaction.options.getInteger('page') || 1;
  const { rows, total } = await getInventory(user.id, page);
  const pages = Math.max(1, Math.ceil(total / 10));
  const embed = new EmbedBuilder()
    .setTitle(`${interaction.user.username} sitt inventory`)
    .setColor(0x5865f2)
    .setDescription(rows.length ? rows.map(formatCardLine).join('\n') : 'Du har ingen kort ennå. Bruk /claim.')
    .setFooter({ text: `Side ${page}/${pages} - ${total} unike kort` });

  await interaction.reply({ embeds: [embed] });
}
