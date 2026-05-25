# Natobot

Natobot er en Discord-bot bygget i Node.js med `discord.js` og PostgreSQL. Den fungerer som et humoristisk samlekortspill med NATO-/tropp-tema: brukere claimer kort, bygger tropper, kjemper, trader, kjøper pakker og bruker marketplace.

## Funksjoner

- Slash commands for alle bruker- og adminfunksjoner.
- Automatisk brukerregistrering første gang en bruker kjører en command.
- PostgreSQL-lagring av brukere, kort, eierskap, squads, battles, trades, marketplace, cooldowns og transactions.
- `/claim` med 3 timers cooldown og droprates: Common 62 %, Rare 25 %, Epic 9 %, Legendary 3,5 %, Mythic 0,5 %.
- Inventory, kortinfo, squads på opptil 5 kort, kampberegning med stats, rarity-bonus og random variasjon.
- Coins, daily, shop, Low/Standard/Legendary packs, quick-sell og leaderboards.
- Sikker trading med locked cards og accept fra begge parter.
- Marketplace med sell, buy, cancel og list.
- Admin commands for kort, coins, claim reset og databaseinfo.

## Filstruktur

```text
src/
  commands/          Slash commands
  data/cards.js      Seed-kort
  database/          PostgreSQL pool, schema og init
  services/          Spillogikk
  utils/             Rarity, rating og formattering
  index.js           Bot startup
scripts/             Manuell migrate/seed/command deploy
```

## Lokalt oppsett

1. Installer Node.js 20 eller nyere.
2. Installer PostgreSQL lokalt, eller bruk Railway PostgreSQL.
3. Kopier `.env.example` til `.env`.
4. Fyll inn:

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=
DATABASE_URL=postgresql://...
OWNER_IDS=din_discord_user_id
ADMIN_ROLE_ID=
```

5. Installer dependencies:

```bash
npm install
```

6. Kjør databaseoppsett:

```bash
npm run db:migrate
npm run db:seed
```

7. Start botten:

```bash
npm start
```

Ved startup kjører botten også migration, seed og slash-command registration automatisk.

## Discord Developer Portal

1. Gå til <https://discord.com/developers/applications>.
2. Opprett en ny application.
3. Gå til **Bot**, opprett bot og kopier token til `DISCORD_TOKEN`.
4. Gå til **OAuth2 -> General**, kopier Application ID til `CLIENT_ID`.
5. Under **Bot** kan du aktivere intents hvis du senere utvider botten. Denne versjonen trenger bare `Guilds`.
6. Gå til **OAuth2 -> URL Generator**.
7. Velg scopes: `bot` og `applications.commands`.
8. Velg permissions som minst inkluderer `Send Messages`, `Use Slash Commands` og `Embed Links`.
9. Åpne URL-en og inviter botten til serveren.
10. For rask slash-command testing, legg server-ID i `GUILD_ID`. Uten `GUILD_ID` registreres commands globalt, som kan ta lengre tid.

## Railway deploy

1. Push prosjektet til GitHub.
2. Opprett et nytt Railway-prosjekt.
3. Velg **Deploy from GitHub repo** og koble til repoet.
4. Legg til PostgreSQL i Railway-prosjektet.
5. Kopier Railway sin `DATABASE_URL` til bot-servicen, eller bruk Railway sin reference variable.
6. Legg inn miljøvariabler i Railway:

```env
DISCORD_TOKEN=real_bot_token_from_discord_developer_portal
CLIENT_ID=real_numeric_discord_application_id
GUILD_ID=optional_numeric_discord_server_id_or_leave_empty
DATABASE_URL=${{Postgres.DATABASE_URL}}
OWNER_IDS=your_numeric_discord_user_id
ADMIN_ROLE_ID=optional_numeric_role_id_or_leave_empty
NODE_ENV=production
```

Do not paste the placeholder values from `.env.example` into Railway. If Railway logs show a URL containing
`your_discord_application_id` or `optional_test_server_id_for_fast_command_registration`, the variables are still wrong.

`DATABASE_URL` must be a PostgreSQL URL like `postgresql://...`. It must not be a volume path such as `/var/lib/postgresql/data`.

7. Railway bruker `npm start` fra `package.json`.
8. Første deploy vil kjøre migrations og seed automatisk ved startup.
9. Se Railway logs for:

```text
[database] Migrations complete
[database] Seeded ...
[discord] Registered ...
[discord] Logged in as ...
```

## Viktige commands

- `/claim`
- `/inventory page:1`
- `/card query:Jens`
- `/squad view`
- `/squad add card:Jens`
- `/squad remove card:1`
- `/squad auto`
- `/battle user:@bruker`
- `/balance`
- `/daily`
- `/shop`
- `/buy pack:standard`
- `/sell cards:123`
- `/sell cards:123, 124, 125`
- `/leaderboard type:wins`
- `/trade start user:@bruker`
- `/trade add-card trade-id:1 card:123`
- `/trade coins trade-id:1 amount:500`
- `/trade accept trade-id:1`
- `/market sell card:123 price:1000`
- `/market list`
- `/market buy listing-id:1`
- `/admin stats`

## Kort og copy-id

Inventory grupperer duplikater etter korttype, men viser copy-id-er internt i databasen når kort brukes i squad, trade og marketplace. Du kan bruke kortnavn for enkel bruk, eller copy-id når du vil styre akkurat hvilken duplikat som brukes.

## Økonomi

- Low Pack: 5 000 coins, 3 kort, mest Common/Rare.
- Standard Pack: 10 000 coins, 4 kort, balansert hovedpakke.
- Legendary Pack: 100 000 coins, 5 kort, garantert minst Epic og høy Legendary/Mythic-sjanse.
- Nye brukere starter med 10 000 coins.
- Daily gir 7 500 coins.
- Battle winner får 3 500 coins, taper får 750 coins.
- `/sell` har autocomplete på kort du eier og kan selge flere copy-id-er samtidig, f.eks. `/sell cards:123, 124, 125`.

## Admin-tilgang

Admin commands er beskyttet av enten:

- `OWNER_IDS`, en kommaseparert liste med Discord user IDs.
- `ADMIN_ROLE_ID`, en Discord role ID.

Ikke legg tokens, passord eller database-URL direkte i kode. Bruk `.env` lokalt og Railway variables i produksjon.
