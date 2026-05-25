import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { query } from '../database/pool.js';
import { ensureUser, addCoins } from '../services/users.js';
import { findCard, grantCard } from '../services/cards.js';

function isAdmin(interaction) {
  const isOwner = config.ownerIds.includes(interaction.user.id);
  const hasRole = config.adminRoleId && interaction.member?.roles?.cache?.has(config.adminRoleId);
  return Boolean(isOwner || hasRole);
}

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin-verktøy.')
  .addSubcommand((sub) =>
    sub
      .setName('add-card')
      .setDescription('Legg til et kort.')
      .addStringOption((o) => o.setName('name').setDescription('Navn').setRequired(true))
      .addStringOption((o) => o.setName('rarity').setDescription('Rarity').setRequired(true).addChoices(
        { name: 'Common', value: 'Common' },
        { name: 'Rare', value: 'Rare' },
        { name: 'Epic', value: 'Epic' },
        { name: 'Legendary', value: 'Legendary' },
        { name: 'Mythic', value: 'Mythic' }
      ))
      .addStringOption((o) => o.setName('category').setDescription('Kategori').setRequired(true))
      .addStringOption((o) => o.setName('description').setDescription('Beskrivelse').setRequired(true))
      .addIntegerOption((o) => o.setName('attack').setDescription('Attack').setRequired(true))
      .addIntegerOption((o) => o.setName('defense').setDescription('Defense').setRequired(true))
      .addIntegerOption((o) => o.setName('influence').setDescription('Influence').setRequired(true))
      .addIntegerOption((o) => o.setName('strategy').setDescription('Strategy').setRequired(true))
      .addIntegerOption((o) => o.setName('charisma').setDescription('Charisma').setRequired(true))
      .addStringOption((o) => o.setName('image-url').setDescription('Bilde-URL'))
  )
  .addSubcommand((sub) =>
    sub.setName('toggle-card').setDescription('Aktiver/deaktiver kort.').addStringOption((o) => o.setName('card').setDescription('Kort').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('remove-card').setDescription('Deaktiver et kort.').addStringOption((o) => o.setName('card').setDescription('Kort').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('give-coins')
      .setDescription('Gi eller fjern coins.')
      .addUserOption((o) => o.setName('user').setDescription('Bruker').setRequired(true))
      .addIntegerOption((o) => o.setName('amount').setDescription('Beløp, negativt for trekk').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('give-card')
      .setDescription('Gi kort til bruker.')
      .addUserOption((o) => o.setName('user').setDescription('Bruker').setRequired(true))
      .addStringOption((o) => o.setName('card').setDescription('Kortnavn/id').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('reset-claim')
      .setDescription('Nullstill claim cooldown.')
      .addUserOption((o) => o.setName('user').setDescription('Bruker').setRequired(true))
  )
  .addSubcommand((sub) => sub.setName('stats').setDescription('Vis databaseinfo.'));

export async function execute(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: 'Du mangler admin-tilgang.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'add-card') {
    await query(
      `INSERT INTO cards (name, image_url, rarity, category, description, attack, defense, influence, strategy, charisma)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (name) DO UPDATE SET image_url = EXCLUDED.image_url, rarity = EXCLUDED.rarity, category = EXCLUDED.category,
       description = EXCLUDED.description, attack = EXCLUDED.attack, defense = EXCLUDED.defense, influence = EXCLUDED.influence,
       strategy = EXCLUDED.strategy, charisma = EXCLUDED.charisma, active = TRUE`,
      [
        interaction.options.getString('name'),
        interaction.options.getString('image-url'),
        interaction.options.getString('rarity'),
        interaction.options.getString('category'),
        interaction.options.getString('description'),
        interaction.options.getInteger('attack'),
        interaction.options.getInteger('defense'),
        interaction.options.getInteger('influence'),
        interaction.options.getInteger('strategy'),
        interaction.options.getInteger('charisma')
      ]
    );
    await interaction.reply('Kortet er lagt til/oppdatert.');
    return;
  }

  if (sub === 'toggle-card') {
    const card = await findCard(interaction.options.getString('card'));
    if (!card) throw new Error('Fant ikke kortet.');
    const result = await query('UPDATE cards SET active = NOT active WHERE id = $1 RETURNING active', [card.id]);
    await interaction.reply(`${card.name} er nå ${result.rows[0].active ? 'aktivt' : 'deaktivert'}.`);
    return;
  }

  if (sub === 'remove-card') {
    const card = await findCard(interaction.options.getString('card'));
    if (!card) throw new Error('Fant ikke kortet.');
    await query('UPDATE cards SET active = FALSE WHERE id = $1', [card.id]);
    await interaction.reply(`${card.name} er deaktivert og kan ikke droppes i nye packs/claims.`);
    return;
  }

  if (sub === 'give-coins') {
    const target = await ensureUser(interaction.options.getUser('user'));
    const amount = interaction.options.getInteger('amount');
    await addCoins(target.id, amount, 'admin_adjustment', { by: interaction.user.id });
    await interaction.reply(`${amount} coins justert for <@${target.discord_id}>.`);
    return;
  }

  if (sub === 'give-card') {
    const target = await ensureUser(interaction.options.getUser('user'));
    const card = await findCard(interaction.options.getString('card'));
    if (!card) throw new Error('Fant ikke kortet.');
    await grantCard(target.id, card.id);
    await interaction.reply(`Ga ${card.name} til <@${target.discord_id}>.`);
    return;
  }

  if (sub === 'reset-claim') {
    const target = await ensureUser(interaction.options.getUser('user'));
    await query('UPDATE users SET last_claim_at = NULL WHERE id = $1', [target.id]);
    await interaction.reply(`Claim cooldown nullstilt for <@${target.discord_id}>.`);
    return;
  }

  const stats = await query(`
    SELECT
      (SELECT COUNT(*) FROM users)::INT AS users,
      (SELECT COUNT(*) FROM cards)::INT AS cards,
      (SELECT COUNT(*) FROM user_cards)::INT AS owned_cards,
      (SELECT COUNT(*) FROM battles)::INT AS battles,
      (SELECT COUNT(*) FROM market_listings WHERE status = 'open')::INT AS market_open
  `);
  const row = stats.rows[0];
  const embed = new EmbedBuilder()
    .setTitle('Databaseinfo')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Users', value: String(row.users), inline: true },
      { name: 'Cards', value: String(row.cards), inline: true },
      { name: 'Owned cards', value: String(row.owned_cards), inline: true },
      { name: 'Battles', value: String(row.battles), inline: true },
      { name: 'Open listings', value: String(row.market_open), inline: true }
    );
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
