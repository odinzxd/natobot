import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './pool.js';
import { seedCards } from '../data/cards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const sql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
  console.log('[database] Migrations complete');
}

export async function seed() {
  for (const card of seedCards) {
    await query(
      `INSERT INTO cards
        (name, image_url, rarity, category, description, attack, defense, influence, strategy, charisma)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (name) DO UPDATE SET
        image_url = EXCLUDED.image_url,
        rarity = EXCLUDED.rarity,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        attack = EXCLUDED.attack,
        defense = EXCLUDED.defense,
        influence = EXCLUDED.influence,
        strategy = EXCLUDED.strategy,
        charisma = EXCLUDED.charisma`,
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
        card.charisma
      ]
    );
  }
  console.log(`[database] Seeded ${seedCards.length} cards`);
}

export async function initDatabase() {
  await migrate();
  await seed();
}
