export const rarityColors = {
  Common: 0x8a8f98,
  Rare: 0x2f80ed,
  Epic: 0x9b51e0,
  Legendary: 0xf2c94c,
  Mythic: 0xeb5757
};

export const rarityBonus = {
  Common: 0,
  Rare: 20,
  Epic: 45,
  Legendary: 85,
  Mythic: 130
};

export const defaultDropRates = {
  Common: 62,
  Rare: 25,
  Epic: 9,
  Legendary: 3.5,
  Mythic: 0.5
};

export const rarityBaseSellValues = {
  Common: 750,
  Rare: 2200,
  Epic: 6500,
  Legendary: 22000,
  Mythic: 65000
};

export const packConfigs = {
  low: {
    label: 'Low Pack',
    price: 5000,
    cards: 3,
    description: 'Billig pakke med mest common og rare. Bra for å fylle inventory.',
    rates: { Common: 82, Rare: 15, Epic: 2.8, Legendary: 0.2, Mythic: 0 }
  },
  standard: {
    label: 'Standard Pack',
    price: 10000,
    cards: 4,
    description: 'Hovedpakken. God blanding, liten sjanse for store hits.',
    rates: { Common: 58, Rare: 28, Epic: 10, Legendary: 3.5, Mythic: 0.5 }
  },
  legendary: {
    label: 'Legendary Pack',
    price: 100000,
    cards: 5,
    description: 'Dyr elitepakke med garantert Epic+ og høy sjanse for Legendary/Mythic.',
    rates: { Common: 0, Rare: 18, Epic: 46, Legendary: 28, Mythic: 8 },
    guaranteedMinimum: 'Epic'
  }
};

export const rarityOrder = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];

export function cardRating(card) {
  return card.attack + card.defense + card.influence + card.strategy + card.charisma;
}

export function cardSellValue(card) {
  if (card.sell_value && Number(card.sell_value) > 100) return Number(card.sell_value);
  const base = rarityBaseSellValues[card.rarity] || 750;
  const ratingBonus = Math.max(0, cardRating(card) - 250) * 12;
  return Math.round((base + ratingBonus) / 50) * 50;
}

export function formatCardLine(row) {
  const count = row.count ? ` x${row.count}` : '';
  const copies = row.copies?.length ? ` copies: ${row.copies.join(', ')}` : '';
  const sell = row.sell_value ? ` - sell ${row.sell_value} coins` : '';
  return `#${row.card_id || row.id} ${row.name} [${row.rarity}] - ${cardRating(row)} rating${sell}${count}${copies}`;
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}t ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function pickWeighted(rates) {
  const entries = Object.entries(rates);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return entries.at(-1)[0];
}
