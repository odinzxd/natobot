import { withTransaction } from '../database/pool.js';
import { packConfigs, pickWeighted, rarityOrder } from '../utils/format.js';

async function drawCardInTransaction(client, rates) {
  const rarity = pickWeighted(rates);
  let cardResult = await client.query('SELECT * FROM cards WHERE rarity = $1 AND active = TRUE ORDER BY RANDOM() LIMIT 1', [rarity]);
  if (!cardResult.rowCount) {
    cardResult = await client.query('SELECT * FROM cards WHERE active = TRUE ORDER BY RANDOM() LIMIT 1');
  }
  if (!cardResult.rowCount) throw new Error('Ingen aktive kort finnes i databasen.');
  return cardResult.rows[0];
}

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
    const userCardIds = [];
    for (let i = 0; i < pack.cards; i += 1) {
      const card = await drawCardInTransaction(client, pack.rates);
      const userCard = await client.query('INSERT INTO user_cards (user_id, card_id) VALUES ($1, $2) RETURNING id', [userId, card.id]);
      userCardIds.push(userCard.rows[0].id);
      cards.push(card);
    }

    if (pack.guaranteedMinimum) {
      const minimumIndex = rarityOrder.indexOf(pack.guaranteedMinimum);
      const hasGuaranteed = cards.some((card) => rarityOrder.indexOf(card.rarity) >= minimumIndex);
      if (!hasGuaranteed) {
        const upgradeRates = Object.fromEntries(Object.entries(pack.rates).filter(([rarity]) => rarityOrder.indexOf(rarity) >= minimumIndex));
        const upgraded = await drawCardInTransaction(client, upgradeRates);
        await client.query('UPDATE user_cards SET card_id = $1 WHERE id = $2', [upgraded.id, userCardIds[userCardIds.length - 1]]);
        cards[cards.length - 1] = upgraded;
      }
    }

    return { pack, cards };
  });
}

export async function sellOwnedCard(userId, userCardId) {
  const result = await sellOwnedCards(userId, [userCardId]);
  return result.cards[0];
}

export async function sellOwnedCards(userId, userCardIds) {
  const uniqueIds = [...new Set(userCardIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) throw new Error('Skriv inn minst én gyldig copy-id fra inventory.');

  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT uc.id AS user_card_id, c.*
       FROM user_cards uc
       JOIN cards c ON c.id = uc.card_id
       WHERE uc.id = ANY($1::BIGINT[]) AND uc.user_id = $2 AND uc.locked_reason IS NULL AND c.active = TRUE
       FOR UPDATE OF uc`,
      [uniqueIds, userId]
    );
    if (result.rowCount !== uniqueIds.length) {
      throw new Error('Ett eller flere kort finnes ikke, eies ikke av deg, eller er låst i trade/market.');
    }

    const cards = result.rows;
    const total = cards.reduce((sum, card) => sum + Number(card.sell_value), 0);
    await client.query('DELETE FROM squads WHERE user_card_id = ANY($1::BIGINT[])', [uniqueIds]);
    await client.query('DELETE FROM user_cards WHERE id = ANY($1::BIGINT[])', [uniqueIds]);
    await client.query('UPDATE users SET coins = coins + $1, updated_at = NOW() WHERE id = $2', [total, userId]);
    await client.query('INSERT INTO transactions (user_id, amount, type, metadata) VALUES ($1, $2, $3, $4)', [
      userId,
      total,
      'quick_sell',
      {
        user_card_ids: uniqueIds,
        cards: cards.map((card) => ({ card_id: card.id, copy_id: card.user_card_id, name: card.name, sell_value: card.sell_value }))
      }
    ]);

    return { cards, total };
  });
}
