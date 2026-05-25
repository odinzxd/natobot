CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 10000,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  last_claim_at TIMESTAMPTZ,
  last_daily_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ALTER COLUMN coins SET DEFAULT 10000;

CREATE TABLE IF NOT EXISTS cards (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  image_url TEXT,
  rarity TEXT NOT NULL CHECK (rarity IN ('Common', 'Rare', 'Epic', 'Legendary', 'Mythic')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  attack INTEGER NOT NULL,
  defense INTEGER NOT NULL,
  influence INTEGER NOT NULL,
  strategy INTEGER NOT NULL,
  charisma INTEGER NOT NULL,
  sell_value INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cards ADD COLUMN IF NOT EXISTS sell_value INTEGER NOT NULL DEFAULT 100;

CREATE TABLE IF NOT EXISTS user_cards (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  locked_reason TEXT,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_card_id ON user_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_locked ON user_cards(locked_reason);

CREATE TABLE IF NOT EXISTS squads (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
  user_card_id BIGINT NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, position),
  UNIQUE (user_id, user_card_id)
);

CREATE TABLE IF NOT EXISTS battles (
  id BIGSERIAL PRIMARY KEY,
  challenger_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  challenger_score NUMERIC(10,2) NOT NULL,
  opponent_score NUMERIC(10,2) NOT NULL,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
  id BIGSERIAL PRIMARY KEY,
  initiator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initiator_coins INTEGER NOT NULL DEFAULT 0,
  target_coins INTEGER NOT NULL DEFAULT 0,
  initiator_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  target_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_items (
  id BIGSERIAL PRIMARY KEY,
  trade_id BIGINT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  from_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_card_id BIGINT NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
  UNIQUE (trade_id, user_card_id)
);

CREATE TABLE IF NOT EXISTS market_listings (
  id BIGSERIAL PRIMARY KEY,
  seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_card_id BIGINT NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
  price INTEGER NOT NULL CHECK (price > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sold', 'cancelled')),
  buyer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_one_open_listing_per_card
  ON market_listings(user_card_id)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
