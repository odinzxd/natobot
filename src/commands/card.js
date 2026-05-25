import { SlashCommandBuilder } from 'discord.js';
import { findCard, cardEmbed } from '../services/cards.js';

export const data = new SlashCommandBuilder()
  .setName('card')
  .setDescription('Vis detaljert kortinfo.')
  .addStringOption((option) => option.setName('query').setDescription('Kortnavn eller kort-id').setRequired(true));

export async function execute(interaction) {
  const card = await findCard(interaction.options.getString('query'));
  if (!card) {
    await interaction.reply({ content: 'Fant ikke kortet.', ephemeral: true });
    return;
  }
  await interaction.reply({ embeds: [cardEmbed(card)] });
}
