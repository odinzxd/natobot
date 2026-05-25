import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { query } from '../database/pool.js';
import { config } from '../config.js';
import { drawRandomCard, grantCard } from '../services/cards.js';
import { ensureUser } from '../services/users.js';
import { cardRating, formatDuration, rarityColors } from '../utils/format.js';

export const data = new SlashCommandBuilder().setName('claim').setDescription('Claim et tilfeldig kort hver tredje time.');

export async function execute(interaction) {
  const user = await ensureUser(interaction.user);
  const cooldownMs = config.claimCooldownHours * 60 * 60 * 1000;
  if (user.last_claim_at) {
    const elapsed = Date.now() - new Date(user.last_claim_at).getTime();
    if (elapsed < cooldownMs) {
      await interaction.reply({ content: `Du kan claime igjen om ${formatDuration(cooldownMs - elapsed)}.`, ephemeral: true });
      return;
    }
  }

  const card = await drawRandomCard();
  await grantCard(user.id, card.id);
  await query('UPDATE users SET last_claim_at = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);

  const embed = new EmbedBuilder()
    .setTitle(`Du claimet ${card.name}!`)
    .setColor(rarityColors[card.rarity])
    .setDescription(card.description)
    .setImage(card.image_url || null)
    .addFields(
      { name: 'Rarity', value: card.rarity, inline: true },
      { name: 'Rating', value: String(cardRating(card)), inline: true },
      { name: 'Kategori', value: card.category, inline: true }
    );

  await interaction.reply({ embeds: [embed] });
}
