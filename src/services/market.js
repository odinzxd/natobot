import { query, withTransaction } from '../database/pool.js';

export async function sellCard(sellerId, userCardId, price) {
  return withTransaction(async (client) => {
    const card = await client.query('SELECT * FROM user_cards WHERE id = $1 AND user_id = $2 AND locked_reason IS NULL FOR UPDATE', [
      userCardId,
      sellerId
    ]);
    if (!card.rowCount) throw new Error('Du eier ikke dette kortet, eller det er låst.');
    await client.query('DELETE FROM squads WHERE user_card_id = $1', [userCardId]);
    await client.query('UPDATE user_cards SET locked_reason = $1 WHERE id = $2', ['market', userCardId]);
    const result = await client.query(
      'INSERT INTO market_listings (seller_id, user_card_id, price) VALUES ($1, $2, $3) RETURNING *',
      [sellerId, userCardId, price]
    );
    return result.rows[0];
  });
}

export async function listMarket(page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;
  const result = await query(
    `SELECT ml.id, ml.price, u.username AS seller, c.name, c.rarity
     FROM market_listings ml
     JOIN users u ON u.id = ml.seller_id
     JOIN user_cards uc ON uc.id = ml.user_card_id
     JOIN cards c ON c.id = uc.card_id
     WHERE ml.status = 'open'
     ORDER BY ml.created_at DESC
     LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );
  return result.rows;
}

export async function buyListing(buyerId, listingId) {
  return withTransaction(async (client) => {
    const listingResult = await client.query('SELECT * FROM market_listings WHERE id = $1 AND status = $2 FOR UPDATE', [listingId, 'open']);
    if (!listingResult.rowCount) throw new Error('Listing finnes ikke.');
    const listing = listingResult.rows[0];
    if (listing.seller_id === buyerId) throw new Error('Du kan ikke kjøpe ditt eget kort.');

    const buyer = await client.query('SELECT coins FROM users WHERE id = $1 FOR UPDATE', [buyerId]);
    if (buyer.rows[0].coins < listing.price) throw new Error('Du har ikke nok coins.');

    await client.query('UPDATE users SET coins = coins - $1 WHERE id = $2', [listing.price, buyerId]);
    await client.query('UPDATE users SET coins = coins + $1 WHERE id = $2', [listing.price, listing.seller_id]);
    await client.query('DELETE FROM squads WHERE user_card_id = $1', [listing.user_card_id]);
    await client.query('UPDATE user_cards SET user_id = $1, locked_reason = NULL WHERE id = $2', [buyerId, listing.user_card_id]);
    await client.query('UPDATE market_listings SET status = $1, buyer_id = $2, sold_at = NOW() WHERE id = $3', [
      'sold',
      buyerId,
      listingId
    ]);
    return listing;
  });
}

export async function cancelListing(userId, listingId) {
  await withTransaction(async (client) => {
    const listing = await client.query('SELECT * FROM market_listings WHERE id = $1 AND seller_id = $2 AND status = $3 FOR UPDATE', [
      listingId,
      userId,
      'open'
    ]);
    if (!listing.rowCount) throw new Error('Fant ikke en åpen listing som du eier.');
    await client.query('UPDATE user_cards SET locked_reason = NULL WHERE id = $1', [listing.rows[0].user_card_id]);
    await client.query('UPDATE market_listings SET status = $1 WHERE id = $2', ['cancelled', listingId]);
  });
}
