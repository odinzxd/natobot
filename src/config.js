import 'dotenv/config';

const placeholderValues = new Set([
  'your_discord_bot_token',
  'your_discord_application_id',
  'optional_test_server_id_for_fast_command_registration',
  'optional_role_id',
  'din_discord_user_id'
]);

function cleanValue(value) {
  const trimmed = value?.trim();
  if (!trimmed || placeholderValues.has(trimmed)) return null;
  return trimmed;
}

function cleanList(value) {
  return (value || '')
    .split(',')
    .map((id) => cleanValue(id))
    .filter(Boolean);
}

export const config = {
  discordToken: cleanValue(process.env.DISCORD_TOKEN),
  clientId: cleanValue(process.env.CLIENT_ID),
  guildId: cleanValue(process.env.GUILD_ID),
  databaseUrl: cleanValue(process.env.DATABASE_URL),
  ownerIds: cleanList(process.env.OWNER_IDS),
  adminRoleId: cleanValue(process.env.ADMIN_ROLE_ID),
  claimCooldownHours: Number(process.env.CLAIM_COOLDOWN_HOURS || 3),
  dailyCooldownHours: Number(process.env.DAILY_COOLDOWN_HOURS || 20)
};

function isDiscordSnowflake(value) {
  return /^\d{17,20}$/.test(value);
}

export function assertConfig() {
  const missing = [];
  if (!config.discordToken) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Railway is probably still using .env.example placeholder values.'
    );
  }

  const invalid = [];
  if (!isDiscordSnowflake(config.clientId)) invalid.push('CLIENT_ID must be the numeric Discord Application ID');
  if (config.guildId && !isDiscordSnowflake(config.guildId)) invalid.push('GUILD_ID must be a numeric Discord server ID, or removed');
  if (config.adminRoleId && !isDiscordSnowflake(config.adminRoleId)) invalid.push('ADMIN_ROLE_ID must be a numeric Discord role ID, or removed');
  for (const ownerId of config.ownerIds) {
    if (!isDiscordSnowflake(ownerId)) invalid.push(`OWNER_IDS contains invalid Discord user ID: ${ownerId}`);
  }
  if (!/^postgres(ql)?:\/\//.test(config.databaseUrl)) {
    invalid.push('DATABASE_URL must be a PostgreSQL connection string, not a volume path');
  }
  if (invalid.length) {
    throw new Error(`Invalid environment configuration: ${invalid.join('; ')}`);
  }
}
