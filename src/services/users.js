import { query } from '../database/pool.js';

export async function ensureUser(discordUser) {
  const username = discordUser.username || discordUser.tag || 'unknown';
  const result = await query(
    `INSERT INTO users (discord_id, username)
     VALUES ($1, $2)
     ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username, updated_at = NOW()
     RETURNING *`,
    [discordUser.id, username]
  );
  return result.rows[0];
}

export async function getUser(discordId) {
  const result = await query('SELECT * FROM users WHERE discord_id = $1', [discordId]);
  return result.rows[0] || null;
}

export async function addCoins(userId, amount, type, metadata = {}) {
  await query('UPDATE users SET coins = coins + $1, updated_at = NOW() WHERE id = $2', [amount, userId]);
  await query('INSERT INTO transactions (user_id, amount, type, metadata) VALUES ($1, $2, $3, $4)', [
    userId,
    amount,
    type,
    metadata
  ]);
}

export async function addXp(userId, amount) {
  await query(
    `UPDATE users
     SET xp = xp + $1,
         level = GREATEST(1, FLOOR((xp + $1) / 500) + 1),
         updated_at = NOW()
     WHERE id = $2`,
    [amount, userId]
  );
}
