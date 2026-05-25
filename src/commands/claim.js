import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { withTransaction } from '../database/pool.js';
import { config } from '../config.js';
import { ensureUser } from '../services/users.js';
import { cardRating, defaultDropRates, formatDuration, pickWeighted, rarityColors } from '../utils/format.js';

export const data = new SlashCommandBuilder().setName('claim').setDescription('Claim et tilfeldig kort hver tredje time.');

export async function execute(interaction) {
  const user = await ensureUser(interaction.user);
  const cooldownMs = config.claimCooldownHours * 60 * 60 * 1000;

  const result = await withTransaction(async (client) => {
    const lockedUser = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    const currentUser = lockedUser.rows[0];

    if (currentUser.last_claim_at) {
      const elapsed = Date.now() - new Date(currentUser.last_claim_at).getTime();
      if (elapsed < cooldownMs) {
        return { cooldownLeftMs: cooldownMs - elapsed };
      }
    }

    const rarity = pickWeighted(defaultDropRates);
    let cardResult = await client.query('SELECT * FROM cards WHERE rarity = $1 AND active = TRUE ORDER BY RANDOM() LIMIT 1', [rarity]);
    if (!cardResult.rowCount) {
      cardResult = await client.query('SELECT * FROM cards WHERE active = TRUE ORDER BY RANDOM() LIMIT 1');
    }
    if (!cardResult.rowCount) throw new Error('Ingen aktive kort finnes i databasen.');

    const card = cardResult.rows[0];
    const userCard = await client.query('INSERT INTO user_cards (user_id, card_id) VALUES ($1, $2) RETURNING id', [user.id, card.id]);
    await client.query('UPDATE users SET last_claim_at = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);

    return { card, copyId: userCard.rows[0].id };
  });

  if (result.cooldownLeftMs) {
    await interaction.reply({ content: `Du kan claime igjen om ${formatDuration(result.cooldownLeftMs)}.`, ephemeral: true });
    return;
  }

  const { card, copyId } = result;

  const embed = new EmbedBuilder()
    .setTitle(`Du claimet ${card.name}!`)
    .setColor(rarityColors[card.rarity])
    .setDescription(card.description)
    .setImage(card.image_url || null)
    .addFields(
      { name: 'Rarity', value: card.rarity, inline: true },
      { name: 'Rating', value: String(cardRating(card)), inline: true },
      { name: 'Kategori', value: card.category, inline: true },
      { name: 'Lagret som', value: `Copy #${copyId}`, inline: true }
    )
    .setFooter({ text: 'Kortet er lagret i inventory. Bruk /squad auto for å legge beste kort i troppen.' });

  await interaction.reply({ embeds: [embed] });
}
