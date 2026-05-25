import { query, withTransaction } from '../database/pool.js';
import { cardRating, rarityBonus } from '../utils/format.js';

export async function getSquad(userId) {
  const result = await query(
    `SELECT s.position, uc.id AS user_card_id, c.*
     FROM squads s
     JOIN user_cards uc ON uc.id = s.user_card_id
     JOIN cards c ON c.id = uc.card_id
     WHERE s.user_id = $1 AND c.active = TRUE
     ORDER BY s.position`,
    [userId]
  );
  return result.rows;
}

export async function addToSquad(userId, ownedCard) {
  return withTransaction(async (client) => {
    const existing = await client.query('SELECT 1 FROM squads WHERE user_id = $1 AND user_card_id = $2', [
      userId,
      ownedCard.user_card_id
    ]);
    if (existing.rowCount) throw new Error('Kortet er allerede i troppen.');

    const count = await client.query('SELECT COUNT(*)::INT AS count FROM squads WHERE user_id = $1', [userId]);
    if (count.rows[0].count >= 5) throw new Error('Troppen er full. Fjern et kort først.');

    const usedPositions = await client.query('SELECT position FROM squads WHERE user_id = $1 ORDER BY position', [userId]);
    const used = new Set(usedPositions.rows.map((row) => row.position));
    const position = [1, 2, 3, 4, 5].find((slot) => !used.has(slot));
    await client.query('INSERT INTO squads (user_id, position, user_card_id) VALUES ($1, $2, $3)', [
      userId,
      position,
      ownedCard.user_card_id
    ]);
    return position;
  });
}

export async function removeFromSquad(userId, cardQuery) {
  const result = /^\d+$/.test(String(cardQuery))
    ? await query('DELETE FROM squads WHERE user_id = $1 AND (position = $2 OR user_card_id = $2) RETURNING *', [userId, cardQuery])
    : await query(
        `DELETE FROM squads s
         USING user_cards uc, cards c
         WHERE s.user_id = $1 AND s.user_card_id = uc.id AND uc.card_id = c.id AND LOWER(c.name) LIKE LOWER($2)
         RETURNING s.*`,
        [userId, `%${cardQuery}%`]
      );
  return result.rowCount > 0;
}

export async function autoSquad(userId) {
  return withTransaction(async (client) => {
    await client.query('DELETE FROM squads WHERE user_id = $1', [userId]);
    const best = await client.query(
      `SELECT uc.id AS user_card_id, c.*,
              (c.attack + c.defense + c.influence + c.strategy + c.charisma) AS rating
       FROM user_cards uc
       JOIN cards c ON c.id = uc.card_id
       WHERE uc.user_id = $1 AND uc.locked_reason IS NULL AND c.active = TRUE
       ORDER BY rating DESC
       LIMIT 5`,
      [userId]
    );
    let position = 1;
    for (const row of best.rows) {
      await client.query('INSERT INTO squads (user_id, position, user_card_id) VALUES ($1, $2, $3)', [
        userId,
        position,
        row.user_card_id
      ]);
      position += 1;
    }
    return best.rows;
  });
}

export function squadRating(squad) {
  return squad.reduce((sum, card) => sum + cardRating(card) + (rarityBonus[card.rarity] || 0), 0);
}
