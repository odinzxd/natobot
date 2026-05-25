import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ensureUser } from '../services/users.js';
import { getOwnedCardCopy } from '../services/cards.js';
import { createTrade, addTradeCard, setTradeCoins, acceptTrade, cancelTrade, getTradeView } from '../services/trades.js';

function renderTrade(view) {
  const { trade, items } = view;
  const side = (userId, coins) => {
    const cards = items.filter((item) => item.from_user_id === userId).map((item) => `${item.name} [${item.rarity}] #${item.user_card_id}`);
    return [`Coins: ${coins}`, ...cards].join('\n') || 'Ingenting';
  };
  return new EmbedBuilder()
    .setTitle(`Trade #${trade.id} (${trade.status})`)
    .setColor(trade.status === 'completed' ? 0x57f287 : 0x2f80ed)
    .addFields(
      {
        name: `<@${trade.initiator_discord_id}> ${trade.initiator_accepted ? 'accepted' : 'not accepted'}`,
        value: side(trade.initiator_id, trade.initiator_coins),
        inline: true
      },
      {
        name: `<@${trade.target_discord_id}> ${trade.target_accepted ? 'accepted' : 'not accepted'}`,
        value: side(trade.target_id, trade.target_coins),
        inline: true
      }
    );
}

export const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Trade kort og coins sikkert.')
  .addSubcommand((sub) =>
    sub.setName('start').setDescription('Start trade.').addUserOption((option) => option.setName('user').setDescription('Bruker').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('add-card')
      .setDescription('Legg kort i trade.')
      .addIntegerOption((option) => option.setName('trade-id').setDescription('Trade ID').setRequired(true))
      .addStringOption((option) => option.setName('card').setDescription('Kortnavn eller copy-id').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('coins')
      .setDescription('Sett coins-tilbud.')
      .addIntegerOption((option) => option.setName('trade-id').setDescription('Trade ID').setRequired(true))
      .addIntegerOption((option) => option.setName('amount').setDescription('Antall coins').setMinValue(0).setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('accept').setDescription('Godkjenn trade.').addIntegerOption((option) => option.setName('trade-id').setDescription('Trade ID').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('cancel').setDescription('Avbryt trade.').addIntegerOption((option) => option.setName('trade-id').setDescription('Trade ID').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('view').setDescription('Vis trade.').addIntegerOption((option) => option.setName('trade-id').setDescription('Trade ID').setRequired(true))
  );

export async function execute(interaction) {
  const user = await ensureUser(interaction.user);
  const sub = interaction.options.getSubcommand();

  if (sub === 'start') {
    const targetUser = interaction.options.getUser('user');
    if (targetUser.bot) throw new Error('Du kan ikke trade med en bot.');
    const target = await ensureUser(targetUser);
    const trade = await createTrade(user.id, target.id);
    await interaction.reply(`Trade #${trade.id} startet mellom <@${user.discord_id}> og <@${target.discord_id}>.`);
    return;
  }

  const tradeId = interaction.options.getInteger('trade-id');

  if (sub === 'add-card') {
    const owned = await getOwnedCardCopy(user.id, interaction.options.getString('card'));
    if (!owned) throw new Error('Fant ikke et tilgjengelig kort du eier.');
    await addTradeCard(tradeId, user.id, owned.user_card_id);
    await interaction.reply(`La ${owned.name} inn i trade #${tradeId}. Begge må godkjenne på nytt.`);
    return;
  }

  if (sub === 'coins') {
    await setTradeCoins(tradeId, user.id, interaction.options.getInteger('amount'));
    await interaction.reply(`Coins-tilbudet er oppdatert for trade #${tradeId}.`);
    return;
  }

  if (sub === 'accept') {
    const result = await acceptTrade(tradeId, user.id);
    await interaction.reply(result.completed ? `Trade #${tradeId} er gjennomført.` : `Du har akseptert trade #${tradeId}.`);
    return;
  }

  if (sub === 'cancel') {
    await cancelTrade(tradeId, user.id);
    await interaction.reply(`Trade #${tradeId} er avbrutt.`);
    return;
  }

  const view = await getTradeView(tradeId);
  if (!view) throw new Error('Fant ikke traden.');
  await interaction.reply({ embeds: [renderTrade(view)] });
}
