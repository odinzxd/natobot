const rarityProfiles = {
  Common: { base: 48, spread: 16, sell: 250 },
  Rare: { base: 61, spread: 15, sell: 1200 },
  Epic: { base: 73, spread: 14, sell: 4200 },
  Legendary: { base: 84, spread: 12, sell: 14500 },
  Mythic: { base: 93, spread: 8, sell: 42000 }
};

const categoryProfiles = {
  'Militær/Strategi': {
    description: 'Strategikort med krigsledelse, taktikk og hard kampkontroll.',
    modifiers: { attack: 7, defense: 5, influence: 1, strategy: 9, charisma: 0 }
  },
  Statsleder: {
    description: 'Statslederkort med makt, diplomati og politisk kontroll.',
    modifiers: { attack: 2, defense: 4, influence: 9, strategy: 6, charisma: 4 }
  },
  Politiker: {
    description: 'Politikerkort med debattkraft, nettverk og taktisk spill.',
    modifiers: { attack: 0, defense: 4, influence: 7, strategy: 7, charisma: 4 }
  },
  Kjendis: {
    description: 'Kjendiskort med enorm oppmerksomhet, hype og publikumsbuff.',
    modifiers: { attack: 4, defense: 0, influence: 8, strategy: 2, charisma: 9 }
  },
  Idrett: {
    description: 'Idrettskort med tempo, press, clutch og ren vinnermentalitet.',
    modifiers: { attack: 9, defense: 3, influence: 5, strategy: 4, charisma: 7 }
  }
};

const cardPools = {
  'Militær/Strategi': {
    Common: [
      'Robert E. Lee',
      'Stonewall Jackson',
      'Mikhail Kutuzov',
      'Ferdinand Foch',
      'Helmuth von Moltke',
      'Gustavus Adolphus',
      'Themistokles',
      'Flavius Belisarius',
      'Bernard Montgomery',
      'Harald Hardråde',
      'Vlad Dracula',
      'Garibaldi'
    ],
    Rare: [
      'George S. Patton',
      'Dwight D. Eisenhower',
      'Douglas MacArthur',
      'Erwin Rommel',
      'Ulysses S. Grant',
      'William Tecumseh Sherman',
      'Richard Løvehjerte',
      'Simón Bolívar',
      'Charles de Gaulle',
      'Isoroku Yamamoto',
      'Chester W. Nimitz',
      'Heinz Guderian'
    ],
    Epic: [
      'Hannibal Barca',
      'Georgij Zjukov',
      'Carl von Clausewitz',
      'Horatio Nelson',
      'Arthur Wellesley, Duke of Wellington',
      'Saladin',
      'Jeanne d’Arc',
      'Tamerlane',
      'Yi Sun-sin',
      'Spartacus',
      'Leonidas av Sparta'
    ],
    Legendary: ['Napoleon Bonaparte', 'Julius Caesar', 'Alexander den store', 'Genghis Khan'],
    Mythic: ['Sun Tzu']
  },
  Statsleder: {
    Common: [
      'George W. Bush',
      'Bill Clinton',
      'Tony Blair',
      'Boris Johnson',
      'Rishi Sunak',
      'Olaf Scholz',
      'Kim Jong-il',
      'Kim Il-sung',
      'Indira Gandhi',
      'Bashar al-Assad',
      'Benito Mussolini',
      'David Ben-Gurion',
      'Joe Biden',
      'Emmanuel Macron',
      'Angela Merkel',
      'Narendra Modi',
      'Benjamin Netanyahu'
    ],
    Rare: [
      'Donald Trump',
      'Barack Obama',
      'Ronald Reagan',
      'John F. Kennedy',
      'Margaret Thatcher',
      'Kim Jong-un',
      'Fidel Castro',
      'Che Guevara',
      'Recep Tayyip Erdoğan'
    ],
    Epic: [
      'Winston Churchill',
      'Franklin D. Roosevelt',
      'Vladimir Putin',
      'Volodymyr Zelenskyj',
      'Xi Jinping',
      'Nelson Mandela',
      'Mahatma Gandhi',
      'Saddam Hussein',
      'Muammar Gaddafi',
      'Ayatollah Khomeini'
    ],
    Legendary: ['Abraham Lincoln', 'Mao Zedong'],
    Mythic: ['Josef Stalin', 'Adolf Hitler']
  },
  Politiker: {
    Common: [
      'Trygve Bratteli',
      'Sylvi Listhaug',
      'Siv Jensen',
      'Carl I. Hagen',
      'Trygve Slagsvold Vedum',
      'Audun Lysbakken',
      'Bjørnar Moxnes',
      'Lan Marie Berg',
      'Abid Raja',
      'Børge Brende',
      'Josep Borrell',
      'Nancy Pelosi',
      'Ine Eriksen Søreide',
      'Espen Barth Eide',
      'Kaja Kallas',
      'Bernie Sanders',
      'Kamala Harris'
    ],
    Rare: [
      'Jonas Gahr Støre',
      'Erna Solberg',
      'Gro Harlem Brundtland',
      'Einar Gerhardsen',
      'Ursula von der Leyen',
      'Hillary Clinton'
    ],
    Epic: ['Jens Stoltenberg'],
    Legendary: [],
    Mythic: []
  },
  Kjendis: {
    Common: [
      'Gordon Ramsay',
      'Kanye West',
      'Snoop Dogg',
      'Mark Zuckerberg',
      'Jeff Bezos',
      'Bill Gates',
      'Dwayne "The Rock" Johnson',
      'Arnold Schwarzenegger',
      'Tom Cruise',
      'Keanu Reeves',
      'Leonardo DiCaprio'
    ],
    Rare: ['Elon Musk', 'Taylor Swift', 'Beyoncé', 'Rihanna'],
    Epic: [],
    Legendary: [],
    Mythic: []
  },
  Idrett: {
    Common: [
      'Zlatan Ibrahimović',
      'Neymar',
      'Conor McGregor',
      'Usain Bolt',
      'LeBron James',
      'Kobe Bryant',
      'Serena Williams',
      'Magnus Carlsen'
    ],
    Rare: ['Cristiano Ronaldo', 'Lionel Messi', 'Erling Braut Haaland', 'Kylian Mbappé', 'Mike Tyson', 'Muhammad Ali', 'Michael Jordan'],
    Epic: [],
    Legendary: [],
    Mythic: []
  }
};

function hashName(name) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function statFor(name, rarity, category, stat, index) {
  const profile = rarityProfiles[rarity];
  const modifier = categoryProfiles[category].modifiers[stat] || 0;
  const noise = (hashName(`${name}:${stat}:${index}`) % profile.spread) - Math.floor(profile.spread / 2);
  return Math.max(25, Math.min(99, profile.base + modifier + noise));
}

function makeCard(name, category, rarity, index) {
  const attack = statFor(name, rarity, category, 'attack', index);
  const defense = statFor(name, rarity, category, 'defense', index);
  const influence = statFor(name, rarity, category, 'influence', index);
  const strategy = statFor(name, rarity, category, 'strategy', index);
  const charisma = statFor(name, rarity, category, 'charisma', index);
  const rating = attack + defense + influence + strategy + charisma;
  const ratingBonus = Math.max(0, rating - 250) * 3;

  return {
    name,
    image_url: null,
    rarity,
    category,
    description: `${categoryProfiles[category].description} ${rarity}-kort med totalrating ${rating}.`,
    attack,
    defense,
    influence,
    strategy,
    charisma,
    sell_value: Math.round((rarityProfiles[rarity].sell + ratingBonus) / 50) * 50
  };
}

export const seedCards = Object.entries(cardPools).flatMap(([category, rarities]) =>
  Object.entries(rarities).flatMap(([rarity, names]) => names.map((name, index) => makeCard(name, category, rarity, index)))
);
