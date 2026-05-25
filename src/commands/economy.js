import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { query } from '../database/pool.js';
import { ensureUser, addCoins } from '../services/users.js';
import { buyPack, sellOwnedCards } from '../services/economy.js';
import { searchOwnedCardCopies } from '../services/cards.js';
import { packConfigs, formatDuration, cardRating, rarityColors } from '../utils/format.js';
import { config } from '../config.js';

function parseCopyIds(input) {
  return [...new Set((input.match(/\d+/g) || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

export const balance = {
  data: new SlashCommandBuilder().setName('balance').setDescription('Vis coins, XP og level.'),
  async execute(interaction) {
    const user = await ensureUser(interaction.user);
    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username} sin konto`)
      .setColor(0xf2c94c)
      .addFields(
        { name: 'Coins', value: String(user.coins), inline: true },
        { name: 'XP', value: String(user.xp), inline: true },
        { name: 'Level', value: String(user.level), inline: true },
        { name: 'Wins/Losses', value: `${user.wins}/${user.losses}`, inline: true }
      );
    await interaction.reply({ embeds: [embed] });
  }
};

export const shop = {
  data: new SlashCommandBuilder().setName('shop').setDescription('Vis kortpakker i butikken.'),
  async execute(interaction) {
    const lines = Object.entries(packConfigs).map(
      ([key, pack]) =>
        `/buy pack:${key} - ${pack.label} - ${pack.price.toLocaleString('no-NO')} coins - ${pack.cards} kort\n` +
        `${pack.description}\n` +
        `Rates: ${Object.entries(pack.rates)
          .map(([rarity, rate]) => `${rarity} ${rate}%`)
          .join(', ')}`
    );
    const embed = new EmbedBuilder().setTitle('NATO Pack Shop').setColor(0x57f287).setDescription(lines.join('\n'));
    await interaction.reply({ embeds: [embed] });
  }
};

export const buy = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Kjøp noe fra shop.')
    .addStringOption((option) =>
      option
        .setName('pack')
        .setDescription('Pakke')
        .setRequired(true)
        .addChoices(
          { name: 'Low Pack - 5 000 coins', value: 'low' },
          { name: 'Standard Pack - 10 000 coins', value: 'standard' },
          { name: 'Legendary Pack - 100 000 coins', value: 'legendary' }
        )
    ),
  async execute(interaction) {
    const user = await ensureUser(interaction.user);
    const { pack, cards } = await buyPack(user.id, interaction.options.getString('pack'));
    const best = cards.toSorted((a, b) => cardRating(b) - cardRating(a))[0];
    const embed = new EmbedBuilder()
      .setTitle(`${pack.label} åpnet!`)
      .setColor(rarityColors[best.rarity])
      .setDescription(cards.map((card) => `${card.name} [${card.rarity}] - ${cardRating(card)}`).join('\n'))
      .setImage(best.image_url || null);
    await interaction.reply({ embeds: [embed] });
  }
};

export const sell = {
  data: new SlashCommandBuilder()
    .setName('sell')
    .setDescription('Selg ett eller flere kort direkte til systemet for coins.')
    .addStringOption((option) =>
      option
        .setName('cards')
        .setDescription('Copy-id-er fra inventory, f.eks. 12, 15, 18')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  async autocomplete(interaction) {
    const user = await ensureUser(interaction.user);
    const focused = interaction.options.getFocused();
    const lastSearch = String(focused).split(',').pop().trim();
    const existingPrefix = String(focused).includes(',') ? `${String(focused).split(',').slice(0, -1).join(',')}, ` : '';
    const cards = await searchOwnedCardCopies(user.id, lastSearch);
    await interaction.respond(
      cards.map((card) => ({
        name: `#${card.user_card_id} ${card.name} [${card.rarity}] - ${Number(card.sell_value).toLocaleString('no-NO')} coins`.slice(0, 100),
        value: `${existingPrefix}${card.user_card_id}`
      }))
    );
  },
  async execute(interaction) {
    const user = await ensureUser(interaction.user);
    const copyIds = parseCopyIds(interaction.options.getString('cards'));
    if (!copyIds.length) {
      await interaction.reply({ content: 'Skriv inn én eller flere copy-id-er fra inventory, f.eks. `12, 15, 18`.', ephemeral: true });
      return;
    }

    const { cards, total } = await sellOwnedCards(user.id, copyIds);
    const preview = cards
      .slice(0, 10)
      .map((card) => `#${card.user_card_id} ${card.name} [${card.rarity}] - ${Number(card.sell_value).toLocaleString('no-NO')}`)
      .join('\n');
    const extra = cards.length > 10 ? `\n...og ${cards.length - 10} til.` : '';
    const best = cards.toSorted((a, b) => cardRating(b) - cardRating(a))[0];
    const embed = new EmbedBuilder()
      .setTitle(`Solgte ${cards.length} kort`)
      .setColor(rarityColors[best.rarity])
      .setDescription(`${preview}${extra}`)
      .addFields(
        { name: 'Totalt', value: `${total.toLocaleString('no-NO')} coins`, inline: true },
        { name: 'Copy-id-er', value: copyIds.join(', ').slice(0, 1024), inline: false }
      );
    await interaction.reply({ embeds: [embed] });
  }
};

export const daily = {
  data: new SlashCommandBuilder().setName('daily').setDescription('Hent daglig coin-belønning.'),
  async execute(interaction) {
    const user = await ensureUser(interaction.user);
    const cooldownMs = config.dailyCooldownHours * 60 * 60 * 1000;
    if (user.last_daily_at) {
      const elapsed = Date.now() - new Date(user.last_daily_at).getTime();
      if (elapsed < cooldownMs) {
        await interaction.reply({ content: `Daily er klar om ${formatDuration(cooldownMs - elapsed)}.`, ephemeral: true });
        return;
      }
    }
    await addCoins(user.id, 7500, 'daily');
    await query('UPDATE users SET last_daily_at = NOW() WHERE id = $1', [user.id]);
    await interaction.reply('Du fikk 7 500 coins fra daily.');
  }
};

export const leaderboard = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Vis leaderboards.')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Leaderboard-type')
        .setRequired(true)
        .addChoices(
          { name: 'Coins', value: 'coins' },
          { name: 'Beste tropp-rating', value: 'squad' },
          { name: 'Legendary/Mythic-kort', value: 'rare_cards' },
          { name: 'Wins', value: 'wins' },
          { name: 'Level/XP', value: 'level' }
        )
    ),
  async execute(interaction) {
    const type = interaction.options.getString('type');
    let sql;
    if (type === 'squad') {
      sql = `SELECT u.username, COALESCE(SUM(c.attack+c.defense+c.influence+c.strategy+c.charisma),0)::INT AS score
             FROM users u LEFT JOIN squads s ON s.user_id = u.id LEFT JOIN user_cards uc ON uc.id = s.user_card_id LEFT JOIN cards c ON c.id = uc.card_id
             GROUP BY u.id ORDER BY score DESC LIMIT 10`;
    } else if (type === 'rare_cards') {
      sql = `SELECT u.username, COUNT(c.id)::INT AS score FROM users u LEFT JOIN user_cards uc ON uc.user_id = u.id LEFT JOIN cards c ON c.id = uc.card_id AND c.rarity IN ('Legendary','Mythic') GROUP BY u.id ORDER BY score DESC LIMIT 10`;
    } else if (type === 'wins') {
      sql = 'SELECT username, wins AS score FROM users ORDER BY wins DESC LIMIT 10';
    } else if (type === 'level') {
      sql = 'SELECT username, (level * 100000 + xp) AS score FROM users ORDER BY level DESC, xp DESC LIMIT 10';
    } else {
      sql = 'SELECT username, coins AS score FROM users ORDER BY coins DESC LIMIT 10';
    }
    const rows = (await query(sql)).rows;
    const embed = new EmbedBuilder()
      .setTitle(`Leaderboard: ${type}`)
      .setColor(0xf2c94c)
      .setDescription(rows.map((row, index) => `${index + 1}. ${row.username} - ${row.score}`).join('\n') || 'Ingen data ennå.');
    await interaction.reply({ embeds: [embed] });
  }
};
