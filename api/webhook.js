require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_HOST = process.env.WEBHOOK_HOST || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
const CHANNEL_USERNAMES = (
  process.env.CHANNEL_USERNAMES || process.env.CHANNEL_USERNAME || "@dilmurodbekmatematika,@Xorazm_ish_bozori1"
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : undefined;

if (!BOT_TOKEN) {
  console.error('Missing required environment variable: BOT_TOKEN.');
}

const bot = new Telegraf(BOT_TOKEN);

// NOTE: Vercel filesystem is ephemeral. sqlite will not persist across deployments.
let db;
try {
  db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
      console.error('Failed to open database (ephemeral on Vercel):', err.message);
      db = null;
      return;
    }
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          user_id INTEGER PRIMARY KEY,
          hdp INTEGER DEFAULT 0,
          omon INTEGER DEFAULT 0
        )
      `);
    });
  });
} catch (e) {
  console.error('SQLite init error:', e.message || e);
  db = null;
}

async function checkSubscription(ctx) {
  for (const channel of CHANNEL_USERNAMES) {
    try {
      const member = await ctx.telegram.getChatMember(channel, ctx.from.id);
      if (
        member.status === 'member' ||
        member.status === 'creator' ||
        member.status === 'administrator'
      ) {
        return true;
      }
    } catch (err) {
      console.error(`Subscription check error for ${channel}:`, err.message);
    }
  }
  return false;
}

function subscriptionKeyboard() {
  const rows = CHANNEL_USERNAMES.map((ch) => [Markup.button.url("Obuna bo'lish", `https://t.me/${ch.replace(/^@/, '')}`)]);
  rows.push([Markup.button.callback('Tekshirish', 'check_sub')]);
  return Markup.inlineKeyboard(rows);
}

function mainMenuKeyboard() {
  return Markup.keyboard(['HDP LC', 'Omon School']).resize().oneTime(false);
}

// ================ Handlers (same behavior as main.js) ================
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  if (db) {
    db.run(`INSERT OR IGNORE INTO users (user_id) VALUES (?)`, [userId], (err) => {
      if (err) console.error('DB Insert error:', err.message);
    });
  }

  const subscribed = await checkSubscription(ctx);

  if (!subscribed) {
    return ctx.reply("Botdan foydalanish uchun kanalga obuna bo'lish:", subscriptionKeyboard());
  }

  return ctx.reply('Ish joyini tanlang:', mainMenuKeyboard());
});

bot.action('check_sub', async (ctx) => {
  const subscribed = await checkSubscription(ctx);

  if (!subscribed) {
    return ctx.answerCbQuery("Siz hali obuna bo'lmagansiz!", { show_alert: true });
  }

  await ctx.deleteMessage().catch(() => {});
  return ctx.reply('Ish joyini tanlang:', mainMenuKeyboard());
});

bot.hears('HDP LC', async (ctx) => {
  const subscribed = await checkSubscription(ctx);
  if (!subscribed) {
    return ctx.reply("Avval kanalga obuna bo'ling:", subscriptionKeyboard());
  }

  if (db) {
    db.run(`UPDATE users SET hdp = hdp + 1 WHERE user_id = ?`, [ctx.from.id], (err) => {
      if (err) console.error('HDP update error:', err.message);
    });
  }

  return ctx.reply('HDP LC uchun forma:', Markup.inlineKeyboard([
    [Markup.button.url('Formani ochish', 'https://forms.gle/f6ZiQtiqCAH1CLy87')],
  ]));
});

bot.hears('Omon School', async (ctx) => {
  const subscribed = await checkSubscription(ctx);
  if (!subscribed) {
    return ctx.reply("Avval kanalga obuna bo'ling:", subscriptionKeyboard());
  }

  if (db) {
    db.run(`UPDATE users SET omon = omon + 1 WHERE user_id = ?`, [ctx.from.id], (err) => {
      if (err) console.error('Omon update error:', err.message);
    });
  }

  return ctx.reply('Omon School uchun forma:', Markup.inlineKeyboard([
    [Markup.button.url('Formani ochish', 'https://forms.gle/97m9hCsBFovYKKrX7')],
  ]));
});

bot.command('admin', async (ctx) => {
  if (!ADMIN_ID || ctx.from.id !== ADMIN_ID) return;

  if (!db) return ctx.reply('Database not available on this hosting.');

  db.get(`SELECT COUNT(*) as total FROM users`, (err, usersRow) => {
    if (err) return console.error(err.message);

    db.get(`SELECT SUM(hdp) as total_hdp, SUM(omon) as total_omon FROM users`, (err2, clicksRow) => {
      if (err2) return console.error(err2.message);

      ctx.reply(`📊 Statistika:\n\n👥 Foydalanuvchilar: ${usersRow.total || 0}\n\n🔹 HDP LC bosilgan: ${clicksRow.total_hdp || 0}\n🔹 Omon School bosilgan: ${clicksRow.total_omon || 0}`);
    });
  });
});

// Try to set webhook if we have a host URL
(async () => {
  try {
    if (WEBHOOK_HOST) {
      const webhookUrl = `${WEBHOOK_HOST.replace(/\/$/, '')}/api/webhook`;
      await bot.telegram.setWebhook(webhookUrl);
      console.log('Webhook set to', webhookUrl);
    } else {
      console.log('WEBHOOK_HOST / VERCEL_URL not set; please set WEBHOOK_HOST env or setWebhook manually.');
    }
  } catch (err) {
    console.error('Failed to set webhook:', err.message);
  }
})();

const webhookHandler = bot.webhookCallback('/api/webhook');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    // Forward incoming update to Telegraf
    return webhookHandler(req, res);
  }

  // Simple health check
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('OK');
};
