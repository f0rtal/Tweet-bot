# Gharred Discord Bot + Private API

This repository runs a Discord bot and a small HTTP API for the Gharred dashboard.

## 1. Create the Discord bot

1. Open https://discord.com/developers/applications
2. Select your application, open **Bot**, and copy/reset the bot token.
3. Invite the bot to the required Discord server(s) with the minimum permissions it needs:
   - View Channels
   - Send Messages (only if you need dashboard announcements)
   - Manage Guild (the API only lists servers where the bot has this permission)
4. Keep the bot token private. Never commit it to GitHub.

## 2. Upload to GitHub

Upload `index.js`, `package.json`, `.env.example`, and `.gitignore`.
Do not upload a real `.env` file.

## 3. Deploy on Euizhost

Create a Node.js service from your repository and set the start command to:

```bash
npm start
```

Use Node.js 20 or newer. Add these environment variables in the host's secret/environment settings:

- `DISCORD_BOT_TOKEN` — token from Discord Developer Portal
- `BOT_SERVICE_SECRET` — a long random secret
- `PORT` — only set this if the host requires it; otherwise the host usually supplies it
- `ALLOWED_GUILD_IDS` — optional comma-separated server IDs to restrict what the API can show

After deployment, open `https://YOUR-HOST-URL/health`. It should return JSON with `ok: true`.

## 4. Configure Gharred's server-side secrets

In Supabase Edge Function secrets, set:

- `BOT_API_BASE_URL` — the base URL of this deployed service, with no `/api` suffix. Example: `https://your-bot-service.example`
- `BOT_SERVICE_SECRET` — exactly the same secret configured on the bot host

The Supabase Edge Function should call endpoints such as `/api/status` and `/api/guilds` using this header:

```http
Authorization: Bearer YOUR_BOT_SERVICE_SECRET
```

**Important:** Do not put `BOT_SERVICE_SECRET` or the Discord bot token in frontend/browser code. Calls must go through the trusted Supabase Edge Function.

## 5. Available endpoints

- `GET /health` — public health check; no secrets are returned
- `GET /api/status` — bot status (requires service secret)
- `GET /api/guilds` — servers where the bot is present and has Manage Server permission
- `GET /api/guilds/:guildId` — server details
- `GET /api/guilds/:guildId/channels` — text, announcement, and forum channels
- `POST /api/guilds/:guildId/messages` — send a plain-text announcement

For protected endpoints, send `Authorization: Bearer <BOT_SERVICE_SECRET>`.

Example announcement body:

```json
{
  "channelId": "DISCORD_CHANNEL_ID",
  "content": "Hello from Gharred"
}
```

## Security notes

- Do not commit secrets to GitHub.
- Keep `BOT_SERVICE_SECRET` identical on the bot host and Supabase.
- Keep `SESSION_SECRET` in Supabase; this bot does not need it.
- The service secret is intended only for server-to-server requests. Do not expose it in frontend JavaScript.
- This starter does not automatically verify a Discord user's ownership of a guild. The Gharred backend must verify the signed-in user's Discord OAuth identity and guild permissions before allowing dashboard actions.
