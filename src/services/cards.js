import { EmbedBuilder } from 'discord.js';
import { query } from '../database/pool.js';
import { cardRating, defaultDropRates, pickWeighted, rarityColors } from '../utils/format.js';

export async function findCard(input, { includeInactive = false } = {}) {
  if (!input) return null;
  const trimmed = input.trim();
  const result = /^\d+$/.test(trimmed)
    ? await query(`SELECT * FROM cards WHERE id = $1 ${includeInactive ? '' : 'AND active = TRUE'}`, [trimmed])
    : await query(
        `SELECT * FROM cards WHERE LOWER(name) LIKE LOWER($1) ${includeInactive ? '' : 'AND active = TRUE'} ORDER BY active DESC, id LIMIT 1`,
        [`%${trimmed}%`]
      );
  return result.rows[0] || null;
}

export async function drawRandomCard(rates = defaultDropRates) {
  const rarity = pickWeighted(rates);
  let result = await query('SELECT * FROM cards WHERE rarity = $1 AND active = TRUE ORDER BY RANDOM() LIMIT 1', [rarity]);
  if (!result.rowCount) {
    result = await query('SELECT * FROM cards WHERE active = TRUE ORDER BY RANDOM() LIMIT 1');
  }
  return result.rows[0];
}

export async function grantCard(userId, cardId) {
  const result = await query('INSERT INTO user_cards (user_id, card_id) VALUES ($1, $2) RETURNING *', [userId, cardId]);
  return result.rows[0];
}

export async function getInventory(userId, page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;
  const rows = await query(
    `SELECT c.id AS card_id, c.name, c.rarity, c.attack, c.defense, c.influence, c.strategy, c.charisma, c.sell_value,
            COUNT(uc.id)::INT AS count,
            ARRAY_AGG(uc.id ORDER BY uc.id) AS copies
     FROM user_cards uc
     JOIN cards c ON c.id = uc.card_id
     WHERE uc.user_id = $1 AND c.active = TRUE
     GROUP BY c.id
     ORDER BY
       CASE c.rarity WHEN 'Mythic' THEN 5 WHEN 'Legendary' THEN 4 WHEN 'Epic' THEN 3 WHEN 'Rare' THEN 2 ELSE 1 END DESC,
       c.name ASC
     LIMIT $2 OFFSET $3`,
    [userId, pageSize, offset]
  );
  const count = await query(
    'SELECT COUNT(DISTINCT uc.card_id)::INT AS total FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = $1 AND c.active = TRUE',
    [userId]
  );
  return { rows: rows.rows, total: count.rows[0].total };
}

export async function getOwnedCardCopy(userId, cardQuery) {
  if (/^\d+$/.test(String(cardQuery))) {
    const byCopy = await query(
      `SELECT uc.id AS user_card_id, c.* FROM user_cards uc
       JOIN cards c ON c.id = uc.card_id
       WHERE uc.id = $1 AND uc.user_id = $2 AND uc.locked_reason IS NULL AND c.active = TRUE`,
      [cardQuery, userId]
    );
    if (byCopy.rows[0]) return byCopy.rows[0];
  }

  const byName = await query(
    `SELECT uc.id AS user_card_id, c.* FROM user_cards uc
     JOIN cards c ON c.id = uc.card_id
     WHERE uc.user_id = $1 AND uc.locked_reason IS NULL AND c.active = TRUE AND LOWER(c.name) LIKE LOWER($2)
     ORDER BY uc.id
     LIMIT 1`,
    [userId, `%${cardQuery}%`]
  );
  return byName.rows[0] || null;
}

export async function searchOwnedCardCopies(userId, search = '', limit = 25) {
  const result = await query(
    `SELECT uc.id AS user_card_id, c.name, c.rarity, c.sell_value,
            (c.attack + c.defense + c.influence + c.strategy + c.charisma) AS rating
     FROM user_cards uc
     JOIN cards c ON c.id = uc.card_id
     WHERE uc.user_id = $1
       AND uc.locked_reason IS NULL
       AND c.active = TRUE
       AND ($2 = '' OR LOWER(c.name) LIKE LOWER($3) OR CAST(uc.id AS TEXT) LIKE $4)
     ORDER BY
       CASE c.rarity WHEN 'Mythic' THEN 5 WHEN 'Legendary' THEN 4 WHEN 'Epic' THEN 3 WHEN 'Rare' THEN 2 ELSE 1 END DESC,
       c.sell_value DESC,
       uc.id ASC
     LIMIT $5`,
    [userId, search, `%${search}%`, `${search}%`, limit]
  );
  return result.rows;
}

export function cardEmbed(card, title = card.name) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(rarityColors[card.rarity] || 0x5865f2)
    .setDescription(card.description)
    .setImage(card.image_url || null)
    .addFields(
      { name: 'Rarity', value: card.rarity, inline: true },
      { name: 'Kategori', value: card.category, inline: true },
      { name: 'Rating', value: String(cardRating(card)), inline: true },
      { name: 'Sell value', value: `${card.sell_value.toLocaleString('no-NO')} coins`, inline: true },
      { name: 'Attack', value: String(card.attack), inline: true },
      { name: 'Defense', value: String(card.defense), inline: true },
      { name: 'Influence', value: String(card.influence), inline: true },
      { name: 'Strategy', value: String(card.strategy), inline: true },
      { name: 'Charisma', value: String(card.charisma), inline: true }
    );
}
