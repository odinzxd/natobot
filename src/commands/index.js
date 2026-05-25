import * as claim from './claim.js';
import * as inventory from './inventory.js';
import * as card from './card.js';
import * as squad from './squad.js';
import * as battle from './battle.js';
import { balance, shop, buy, daily, leaderboard } from './economy.js';
import * as trade from './trade.js';
import * as market from './market.js';
import * as admin from './admin.js';

export const commands = [
  claim,
  inventory,
  card,
  squad,
  battle,
  balance,
  shop,
  buy,
  daily,
  leaderboard,
  trade,
  market,
  admin
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
