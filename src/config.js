import 'dotenv/config';

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  databaseUrl: process.env.DATABASE_URL,
  ownerIds: (process.env.OWNER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean),
  adminRoleId: process.env.ADMIN_ROLE_ID || null,
  claimCooldownHours: Number(process.env.CLAIM_COOLDOWN_HOURS || 3),
  dailyCooldownHours: Number(process.env.DAILY_COOLDOWN_HOURS || 20)
};

export function assertConfig() {
  const missing = [];
  if (!config.discordToken) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
