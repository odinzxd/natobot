import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ensureUser } from '../services/users.js';
import { getOwnedCardCopy } from '../services/cards.js';
import { addToSquad, autoSquad, getSquad, removeFromSquad, squadRating } from '../services/squads.js';
import { cardRating } from '../utils/format.js';

function renderSquad(squad) {
  if (!squad.length) return 'Troppen er tom. Bruk `/squad add` eller `/squad auto`.';
  return squad.map((card) => `${card.position}. ${card.name} [${card.rarity}] - ${cardRating(card)} rating (copy #${card.user_card_id})`).join('\n');
}

export const data = new SlashCommandBuilder()
  .setName('squad')
  .setDescription('Administrer troppen din.')
  .addSubcommand((sub) => sub.setName('view').setDescription('Vis troppen din.'))
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Legg til et kort i troppen.')
      .addStringOption((option) => option.setName('card').setDescription('Kortnavn eller copy-id fra inventory').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Fjern et kort fra troppen.')
      .addStringOption((option) => option.setName('card').setDescription('Posisjon, copy-id eller navn').setRequired(true))
  )
  .addSubcommand((sub) => sub.setName('auto').setDescription('Bygg beste tropp automatisk.'));

export async function execute(interaction) {
  const user = await ensureUser(interaction.user);
  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const owned = await getOwnedCardCopy(user.id, interaction.options.getString('card'));
    if (!owned) {
      await interaction.reply({ content: 'Du eier ikke et tilgjengelig kort som matcher søket.', ephemeral: true });
      return;
    }
    const position = await addToSquad(user.id, owned);
    await interaction.reply(`La til ${owned.name} i posisjon ${position}.`);
    return;
  }

  if (sub === 'remove') {
    const removed = await removeFromSquad(user.id, interaction.options.getString('card'));
    await interaction.reply(removed ? 'Kortet ble fjernet fra troppen.' : 'Fant ikke kortet i troppen din.');
    return;
  }

  if (sub === 'auto') {
    const cards = await autoSquad(user.id);
    await interaction.reply(cards.length ? `Auto-tropp bygget med ${cards.length} kort.` : 'Du har ingen tilgjengelige kort.');
    return;
  }

  const squad = await getSquad(user.id);
  const embed = new EmbedBuilder()
    .setTitle(`${interaction.user.username} sin tropp`)
    .setColor(0x2f80ed)
    .setDescription(renderSquad(squad))
    .addFields({ name: 'Total styrke', value: String(squadRating(squad)), inline: true });
  await interaction.reply({ embeds: [embed] });
}
