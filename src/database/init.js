import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './pool.js';
import { seedCards } from '../data/cards.js';
import { cardSellValue } from '../utils/format.js';
import { resolveCardImage } from '../services/cardImages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const sql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
  console.log('[database] Migrations complete');
}

export async function seed() {
  const seedNames = seedCards.map((card) => card.name);
  const existingImages = new Map(
    (
      await query(
        `SELECT name, image_url
         FROM cards
         WHERE name = ANY($1::TEXT[])
           AND image_url IS NOT NULL
           AND image_url NOT LIKE 'https://ui-avatars.com/%'`,
        [seedNames]
      )
    ).rows.map((row) => [row.name, row.image_url])
  );
  const imageUrls = new Map();
  const cardsMissingImages = seedCards.filter((card) => !card.image_url && !existingImages.has(card.name));
  if (cardsMissingImages.length) {
    console.log(`[images] Resolving images for ${cardsMissingImages.length} cards`);
  }

  for (let i = 0; i < cardsMissingImages.length; i += 8) {
    const batch = cardsMissingImages.slice(i, i + 8);
    const resolved = await Promise.all(batch.map(async (card) => [card.name, await resolveCardImage(card.name)]));
    for (const [name, imageUrl] of resolved) imageUrls.set(name, imageUrl);
  }

  for (const card of seedCards) {
    const sellValue = card.sell_value || cardSellValue(card);
    const imageUrl = card.image_url || existingImages.get(card.name) || imageUrls.get(card.name);
    await query(
      `INSERT INTO cards
        (name, image_url, rarity, category, description, attack, defense, influence, strategy, charisma, sell_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (name) DO UPDATE SET
        rarity = EXCLUDED.rarity,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        attack = EXCLUDED.attack,
        defense = EXCLUDED.defense,
        influence = EXCLUDED.influence,
        strategy = EXCLUDED.strategy,
        charisma = EXCLUDED.charisma,
        sell_value = EXCLUDED.sell_value,
        image_url = COALESCE(EXCLUDED.image_url, cards.image_url),
        active = TRUE`,
      [
        card.name,
        imageUrl,
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
