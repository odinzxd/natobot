import { withTransaction, query } from '../database/pool.js';

export async function createTrade(initiatorId, targetId) {
  if (initiatorId === targetId) throw new Error('Du kan ikke trade med deg selv.');
  const existing = await query(
    `SELECT * FROM trades
     WHERE status = 'open' AND ((initiator_id = $1 AND target_id = $2) OR (initiator_id = $2 AND target_id = $1))
     LIMIT 1`,
    [initiatorId, targetId]
  );
  if (existing.rowCount) return existing.rows[0];
  const result = await query('INSERT INTO trades (initiator_id, target_id) VALUES ($1, $2) RETURNING *', [initiatorId, targetId]);
  return result.rows[0];
}

export async function addTradeCard(tradeId, userId, ownedCardId) {
  await withTransaction(async (client) => {
    const trade = await client.query('SELECT * FROM trades WHERE id = $1 AND status = $2 FOR UPDATE', [tradeId, 'open']);
    if (!trade.rowCount) throw new Error('Trade finnes ikke eller er lukket.');
    if (![trade.rows[0].initiator_id, trade.rows[0].target_id].includes(userId)) throw new Error('Du er ikke med i denne traden.');

    const card = await client.query('SELECT * FROM user_cards WHERE id = $1 AND user_id = $2 AND locked_reason IS NULL FOR UPDATE', [
      ownedCardId,
      userId
    ]);
    if (!card.rowCount) throw new Error('Du eier ikke dette kortet, eller det er låst.');
    await client.query('DELETE FROM squads WHERE user_card_id = $1', [ownedCardId]);
    await client.query('UPDATE user_cards SET locked_reason = $1 WHERE id = $2', [`trade:${tradeId}`, ownedCardId]);
    await client.query('INSERT INTO trade_items (trade_id, from_user_id, user_card_id) VALUES ($1, $2, $3)', [
      tradeId,
      userId,
      ownedCardId
    ]);
    await client.query('UPDATE trades SET initiator_accepted = FALSE, target_accepted = FALSE, updated_at = NOW() WHERE id = $1', [
      tradeId
    ]);
  });
}

export async function setTradeCoins(tradeId, userId, amount) {
  if (amount < 0) throw new Error('Coins kan ikke være negativt.');
  await withTransaction(async (client) => {
    const trade = await client.query('SELECT * FROM trades WHERE id = $1 AND status = $2 FOR UPDATE', [tradeId, 'open']);
    if (!trade.rowCount) throw new Error('Trade finnes ikke eller er lukket.');
    const row = trade.rows[0];
    if (![row.initiator_id, row.target_id].includes(userId)) throw new Error('Du er ikke med i denne traden.');
    const user = await client.query('SELECT coins FROM users WHERE id = $1', [userId]);
    if (user.rows[0].coins < amount) throw new Error('Du har ikke nok coins.');
    const column = row.initiator_id === userId ? 'initiator_coins' : 'target_coins';
    await client.query(`UPDATE trades SET ${column} = $1, initiator_accepted = FALSE, target_accepted = FALSE, updated_at = NOW() WHERE id = $2`, [
      amount,
      tradeId
    ]);
  });
}

export async function acceptTrade(tradeId, userId) {
  return withTransaction(async (client) => {
    const tradeResult = await client.query('SELECT * FROM trades WHERE id = $1 AND status = $2 FOR UPDATE', [tradeId, 'open']);
    if (!tradeResult.rowCount) throw new Error('Trade finnes ikke eller er lukket.');
    const trade = tradeResult.rows[0];
    if (![trade.initiator_id, trade.target_id].includes(userId)) throw new Error('Du er ikke med i denne traden.');
    const flag = trade.initiator_id === userId ? 'initiator_accepted' : 'target_accepted';
    await client.query(`UPDATE trades SET ${flag} = TRUE, updated_at = NOW() WHERE id = $1`, [tradeId]);
    const refreshed = (await client.query('SELECT * FROM trades WHERE id = $1 FOR UPDATE', [tradeId])).rows[0];
    if (!refreshed.initiator_accepted || !refreshed.target_accepted) return { completed: false };

    const initiator = await client.query('SELECT coins FROM users WHERE id = $1 FOR UPDATE', [refreshed.initiator_id]);
    const target = await client.query('SELECT coins FROM users WHERE id = $1 FOR UPDATE', [refreshed.target_id]);
    if (initiator.rows[0].coins < refreshed.initiator_coins || target.rows[0].coins < refreshed.target_coins) {
      throw new Error('En av partene har ikke nok coins lenger.');
    }

    await client.query('UPDATE users SET coins = coins - $1 + $2 WHERE id = $3', [
      refreshed.initiator_coins,
      refreshed.target_coins,
      refreshed.initiator_id
    ]);
    await client.query('UPDATE users SET coins = coins - $1 + $2 WHERE id = $3', [
      refreshed.target_coins,
      refreshed.initiator_coins,
      refreshed.target_id
    ]);

    const items = await client.query('SELECT * FROM trade_items WHERE trade_id = $1', [tradeId]);
    for (const item of items.rows) {
      const newOwner = item.from_user_id === refreshed.initiator_id ? refreshed.target_id : refreshed.initiator_id;
      await client.query('DELETE FROM squads WHERE user_card_id = $1', [item.user_card_id]);
      await client.query('UPDATE user_cards SET user_id = $1, locked_reason = NULL WHERE id = $2', [newOwner, item.user_card_id]);
    }
    await client.query('UPDATE trades SET status = $1, updated_at = NOW() WHERE id = $2', ['completed', tradeId]);
    return { completed: true };
  });
}

export async function cancelTrade(tradeId, userId) {
  await withTransaction(async (client) => {
    const trade = await client.query('SELECT * FROM trades WHERE id = $1 AND status = $2 FOR UPDATE', [tradeId, 'open']);
    if (!trade.rowCount) throw new Error('Trade finnes ikke eller er lukket.');
    if (![trade.rows[0].initiator_id, trade.rows[0].target_id].includes(userId)) throw new Error('Du er ikke med i denne traden.');
    await client.query('UPDATE user_cards SET locked_reason = NULL WHERE locked_reason = $1', [`trade:${tradeId}`]);
    await client.query('UPDATE trades SET status = $1, updated_at = NOW() WHERE id = $2', ['cancelled', tradeId]);
  });
}

export async function getTradeView(tradeId) {
  const trade = await query(
    `SELECT t.*, iu.discord_id AS initiator_discord_id, tu.discord_id AS target_discord_id
     FROM trades t
     JOIN users iu ON iu.id = t.initiator_id
     JOIN users tu ON tu.id = t.target_id
     WHERE t.id = $1`,
    [tradeId]
  );
  if (!trade.rowCount) return null;
  const items = await query(
    `SELECT ti.from_user_id, c.name, c.rarity, uc.id AS user_card_id
     FROM trade_items ti
     JOIN user_cards uc ON uc.id = ti.user_card_id
     JOIN cards c ON c.id = uc.card_id
     WHERE ti.trade_id = $1
     ORDER BY ti.id`,
    [tradeId]
  );
  return { trade: trade.rows[0], items: items.rows };
}
