require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const required = ["DISCORD_BOT_TOKEN", "BOT_SERVICE_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 3000);
const SERVICE_SECRET = process.env.BOT_SERVICE_SECRET;
const allowedGuildIds = new Set(
  (process.env.ALLOWED_GUILD_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function safeEqual(a, b) {
  const crypto = require("node:crypto");
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireServiceSecret(req, res, next) {
  const auth = req.headers.authorization || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!safeEqual(supplied, SERVICE_SECRET)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

function canManageGuild(guild) {
  try {
    const me = guild.members.me;
    return Boolean(me && me.permissions.has(PermissionFlagsBits.ManageGuild));
  } catch {
    return false;
  }
}

function getVisibleGuilds() {
  return client.guilds.cache.filter((guild) => {
    if (allowedGuildIds.size && !allowedGuildIds.has(guild.id)) return false;
    return canManageGuild(guild);
  });
}

function findVisibleGuild(guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  if (allowedGuildIds.size && !allowedGuildIds.has(guild.id)) return null;
  if (!canManageGuild(guild)) return null;
  return guild;
}

// Public health endpoint: deliberately does not expose tokens or secrets.
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "gharred-discord-bot-api",
    botReady: client.isReady(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// All dashboard/service endpoints below require the private shared secret.
app.use("/api", requireServiceSecret);

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    botReady: client.isReady(),
    botUser: client.user
      ? { id: client.user.id, username: client.user.username }
      : null,
    guildCount: client.guilds.cache.size
  });
});

app.get("/api/guilds", (_req, res) => {
  if (!client.isReady()) {
    return res.status(503).json({ ok: false, error: "bot_not_ready" });
  }

  const guilds = [...getVisibleGuilds().values()]
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 128 }),
      memberCount: guild.memberCount
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ ok: true, guilds });
});

app.get("/api/guilds/:guildId", async (req, res) => {
  if (!client.isReady()) {
    return res.status(503).json({ ok: false, error: "bot_not_ready" });
  }

  const guild = findVisibleGuild(req.params.guildId);
  if (!guild) {
    return res.status(404).json({ ok: false, error: "guild_not_found_or_not_allowed" });
  }

  res.json({
    ok: true,
    guild: {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 256 }),
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      createdAt: guild.createdAt.toISOString()
    }
  });
});

app.get("/api/guilds/:guildId/channels", async (req, res) => {
  if (!client.isReady()) {
    return res.status(503).json({ ok: false, error: "bot_not_ready" });
  }

  const guild = findVisibleGuild(req.params.guildId);
  if (!guild) {
    return res.status(404).json({ ok: false, error: "guild_not_found_or_not_allowed" });
  }

  await guild.channels.fetch();
  const channels = [...guild.channels.cache.values()]
    .filter((channel) =>
      [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildForum
      ].includes(channel.type)
    )
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ ok: true, channels });
});

// Safe text announcement endpoint. Call this only from your trusted server-side
// Gharred API, never directly from browser JavaScript.
app.post("/api/guilds/:guildId/messages", async (req, res) => {
  if (!client.isReady()) {
    return res.status(503).json({ ok: false, error: "bot_not_ready" });
  }

  const { channelId, content } = req.body || {};
  if (typeof channelId !== "string" || typeof content !== "string") {
    return res.status(400).json({ ok: false, error: "channelId_and_content_required" });
  }

  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 1900) {
    return res.status(400).json({ ok: false, error: "content_must_be_1_to_1900_characters" });
  }

  // Prevent mass pings by default.
  const guild = findVisibleGuild(req.params.guildId);
  if (!guild) {
    return res.status(404).json({ ok: false, error: "guild_not_found_or_not_allowed" });
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (
    !channel ||
    channel.guildId !== guild.id ||
    !channel.isTextBased() ||
    !channel.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)
  ) {
    return res.status(400).json({ ok: false, error: "channel_unavailable_or_no_permission" });
  }

  const message = await channel.send({
    content: trimmed,
    allowedMentions: { parse: [] }
  });

  res.status(201).json({
    ok: true,
    message: { id: message.id, channelId: message.channelId }
  });
});

app.use((err, _req, res, _next) => {
  console.error("API error:", err?.message || "unknown error");
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: "internal_server_error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Gharred bot API listening on port ${PORT}`);
});

client.once("ready", () => {
  console.log(`Discord bot ready as ${client.user.tag}`);
});

client.on("error", (error) => {
  console.error("Discord client error:", error.message);
});

client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
  console.error("Discord login failed. Check DISCORD_BOT_TOKEN in host secrets.");
  console.error(error.message);
  process.exit(1);
});
