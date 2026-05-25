import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './pool.js';
import { seedCards } from '../data/cards.js';
import { cardSellValue } from '../utils/format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const sql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
  console.log('[database] Migrations complete');
}

export async function seed() {
  const seedNames = seedCards.map((card) => card.name);

  for (const card of seedCards) {
    const sellValue = card.sell_value || cardSellValue(card);
    await query(
      `INSERT INTO cards
        (name, image_url, rarity, category, description, attack, defense, influence, strategy, charisma, sell_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (name) DO UPDATE SET
        image_url = EXCLUDED.image_url,
        rarity = EXCLUDED.rarity,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        attack = EXCLUDED.attack,
        defense = EXCLUDED.defense,
        influence = EXCLUDED.influence,
        strategy = EXCLUDED.strategy,
        charisma = EXCLUDED.charisma,
        sell_value = EXCLUDED.sell_value,
        active = TRUE`,
      [
        card.name,
        card.image_url,
        card.rarity,
        card.category,
        card.description,
        card.attack,
        card.defense,
        card.influence,
        card.strategy,
        card.charisma,
        sellValue
      ]
    );
  }
  await query('UPDATE cards SET active = FALSE WHERE NOT (name = ANY($1::TEXT[]))', [seedNames]);
  await query(
    `DELETE FROM squads
     WHERE user_card_id IN (
       SELECT uc.id FROM user_cards uc
       JOIN cards c ON c.id = uc.card_id
       WHERE c.active = FALSE
     )`
  );
  console.log(`[database] Seeded ${seedCards.length} cards`);
}

export async function initDatabase() {
  await migrate();
  await seed();
}
