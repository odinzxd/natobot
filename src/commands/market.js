import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ensureUser } from '../services/users.js';
import { getOwnedCardCopy } from '../services/cards.js';
import { sellCard, listMarket, buyListing, cancelListing } from '../services/market.js';

export const data = new SlashCommandBuilder()
  .setName('market')
  .setDescription('Kjøp og selg kort.')
  .addSubcommand((sub) =>
    sub
      .setName('sell')
      .setDescription('Legg ut et kort for salg.')
      .addStringOption((option) => option.setName('card').setDescription('Kortnavn eller copy-id').setRequired(true))
      .addIntegerOption((option) => option.setName('price').setDescription('Pris').setMinValue(1).setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('buy')
      .setDescription('Kjøp en listing.')
      .addIntegerOption((option) => option.setName('listing-id').setDescription('Listing ID').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('cancel')
      .setDescription('Kanseller din listing.')
      .addIntegerOption((option) => option.setName('listing-id').setDescription('Listing ID').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Vis markedet.').addIntegerOption((option) => option.setName('page').setDescription('Side').setMinValue(1))
  );

export async function execute(interaction) {
  const user = await ensureUser(interaction.user);
  const sub = interaction.options.getSubcommand();

  if (sub === 'sell') {
    const owned = await getOwnedCardCopy(user.id, interaction.options.getString('card'));
    if (!owned) throw new Error('Fant ikke et tilgjengelig kort du eier.');
    const listing = await sellCard(user.id, owned.user_card_id, interaction.options.getInteger('price'));
    await interaction.reply(`Listing #${listing.id}: ${owned.name} er lagt ut for ${listing.price} coins.`);
    return;
  }

  if (sub === 'buy') {
    await buyListing(user.id, interaction.options.getInteger('listing-id'));
    await interaction.reply('Kjøp gjennomført. Kortet ligger nå i inventory.');
    return;
  }

  if (sub === 'cancel') {
    await cancelListing(user.id, interaction.options.getInteger('listing-id'));
    await interaction.reply('Listing kansellert.');
    return;
  }

  const page = interaction.options.getInteger('page') || 1;
  const listings = await listMarket(page);
  const embed = new EmbedBuilder()
    .setTitle('Marketplace')
    .setColor(0x57f287)
    .setDescription(
      listings.length
        ? listings.map((row) => `#${row.id} ${row.name} [${row.rarity}] - ${row.price} coins - selger: ${row.seller}`).join('\n')
        : 'Ingen åpne listings.'
    );
  await interaction.reply({ embeds: [embed] });
}
