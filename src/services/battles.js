import { EmbedBuilder } from 'discord.js';
import { withTransaction } from '../database/pool.js';
import { getSquad, squadRating } from './squads.js';
import { cardRating } from '../utils/format.js';

function rollScore(base) {
  const variation = 0.9 + Math.random() * 0.2;
  return Math.round(base * variation * 100) / 100;
}

function squadText(squad) {
  return squad.map((card) => `${card.position}. ${card.name} (${card.rarity}, ${cardRating(card)})`).join('\n');
}

export async function runBattle(challenger, opponent) {
  const challengerSquad = await getSquad(challenger.id);
  const opponentSquad = await getSquad(opponent.id);
  if (challengerSquad.length < 1) throw new Error('Du må ha en aktiv tropp først.');
  if (opponentSquad.length < 1) throw new Error('Motstanderen må ha en aktiv tropp først.');

  const challengerScore = rollScore(squadRating(challengerSquad));
  const opponentScore = rollScore(squadRating(opponentSquad));
  const challengerWon = challengerScore >= opponentScore;
  const winner = challengerWon ? challenger : opponent;
  const loser = challengerWon ? opponent : challenger;
  const reward = 250;
  const consolation = 50;

  await withTransaction(async (client) => {
    await client.query('UPDATE users SET coins = coins + $1, xp = xp + 120, wins = wins + 1, level = FLOOR((xp + 120) / 500) + 1 WHERE id = $2', [
      reward,
      winner.id
    ]);
    await client.query('UPDATE users SET coins = coins + $1, xp = xp + 35, losses = losses + 1, level = FLOOR((xp + 35) / 500) + 1 WHERE id = $2', [
      consolation,
      loser.id
    ]);
    await client.query(
      `INSERT INTO battles (challenger_id, opponent_id, winner_id, challenger_score, opponent_score, reward_coins)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [challenger.id, opponent.id, winner.id, challengerScore, opponentScore, reward]
    );
  });

  const embed = new EmbedBuilder()
    .setTitle('NATO-troppkamp')
    .setColor(challengerWon ? 0x57f287 : 0xed4245)
    .setDescription(`Vinner: <@${winner.discord_id}> (+${reward} coins)\nTaper: <@${loser.discord_id}> (+${consolation} coins)`)
    .addFields(
      { name: `${challenger.username} - ${challengerScore}`, value: squadText(challengerSquad), inline: true },
      { name: `${opponent.username} - ${opponentScore}`, value: squadText(opponentSquad), inline: true }
    )
    .setTimestamp();

  return embed;
}
