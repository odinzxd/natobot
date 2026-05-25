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
  Common: 60,
  Rare: 25,
  Epic: 10,
  Legendary: 4,
  Mythic: 1
};

export const packConfigs = {
  basic: {
    label: 'Basic Pack',
    price: 350,
    cards: 3,
    rates: { Common: 68, Rare: 23, Epic: 7, Legendary: 1.8, Mythic: 0.2 }
  },
  premium: {
    label: 'Premium Pack',
    price: 900,
    cards: 4,
    rates: { Common: 42, Rare: 34, Epic: 17, Legendary: 6, Mythic: 1 }
  },
  legendary: {
    label: 'Legendary Pack',
    price: 2500,
    cards: 5,
    rates: { Common: 20, Rare: 32, Epic: 28, Legendary: 16, Mythic: 4 }
  }
};

export function cardRating(card) {
  return card.attack + card.defense + card.influence + card.strategy + card.charisma;
}

export function formatCardLine(row) {
  const count = row.count ? ` x${row.count}` : '';
  const copies = row.copies?.length ? ` copies: ${row.copies.join(', ')}` : '';
  return `#${row.card_id || row.id} ${row.name} [${row.rarity}] - ${cardRating(row)} rating${count}${copies}`;
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
