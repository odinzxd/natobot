import { withTransaction } from '../database/pool.js';
import { packConfigs } from '../utils/format.js';

export async function buyPack(userId, packKey) {
  const pack = packConfigs[packKey];
  if (!pack) throw new Error('Ukjent pakke.');

  return withTransaction(async (client) => {
    const user = await client.query('SELECT coins FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!user.rowCount || user.rows[0].coins < pack.price) throw new Error('Du har ikke nok coins.');
    await client.query('UPDATE users SET coins = coins - $1 WHERE id = $2', [pack.price, userId]);
    await client.query('INSERT INTO transactions (user_id, amount, type, metadata) VALUES ($1, $2, $3, $4)', [
      userId,
      -pack.price,
      'pack_purchase',
      { pack: packKey }
    ]);

    const cards = [];
    for (let i = 0; i < pack.cards; i += 1) {
      const entries = Object.entries(pack.rates);
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = Math.random() * total;
      let rarity = entries.at(-1)[0];
      for (const [candidate, weight] of entries) {
        roll -= weight;
        if (roll <= 0) {
          rarity = candidate;
          break;
        }
      }
      let cardResult = await client.query('SELECT * FROM cards WHERE rarity = $1 AND active = TRUE ORDER BY RANDOM() LIMIT 1', [rarity]);
      if (!cardResult.rowCount) {
        cardResult = await client.query('SELECT * FROM cards WHERE active = TRUE ORDER BY RANDOM() LIMIT 1');
      }
      const card = cardResult.rows[0];
      await client.query('INSERT INTO user_cards (user_id, card_id) VALUES ($1, $2)', [userId, card.id]);
      cards.push(card);
    }
    return { pack, cards };
  });
}
