require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const sqlite3 = require("sqlite3").verbose();
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_HOST = process.env.WEBHOOK_HOST; // e.g. https://your-app.onrender.com
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || "@dilmurodbekmatematika";
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : undefined;
const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;

if (!BOT_TOKEN) {
  console.error("Missing required environment variable: BOT_TOKEN.\nPlease create a .env file with BOT_TOKEN or set it in your environment before starting the bot. See README.md for examples.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// ================= DATABASE =================
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Failed to open database:", err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      hdp INTEGER DEFAULT 0,
      omon INTEGER DEFAULT 0
    )
  `);
});

// ================= HELPERS =================
async function checkSubscription(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(
      CHANNEL_USERNAME,
      ctx.from.id
    );

    return (
      member.status === "member" ||
      member.status === "creator" ||
      member.status === "administrator"
    );
  } catch (err) {
    // common causes: bot not admin in channel or invalid channel username
    console.error("Subscription check error:", err.message);
    return false;
  }
}

function subscriptionKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.url("Obuna bo'lish", `https://t.me/${CHANNEL_USERNAME.replace(/^@/,"")}`),
    ],
    [Markup.button.callback("Tekshirish", "check_sub")],
  ]);
}

function mainMenuKeyboard() {
  return Markup.keyboard(["HDP LC", "Omon School"]).resize().oneTime(false);
}

// ================= HANDLERS =================
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  db.run(`INSERT OR IGNORE INTO users (user_id) VALUES (?)`, [userId], (err) => {
    if (err) console.error("DB Insert error:", err.message);
  });

  const subscribed = await checkSubscription(ctx);

  if (!subscribed) {
    return ctx.reply("Botdan foydalanish uchun kanalga obuna bo‘ling:", subscriptionKeyboard());
  }

  return ctx.reply("Ish joyini tanlang:", mainMenuKeyboard());
});

bot.action("check_sub", async (ctx) => {
  const subscribed = await checkSubscription(ctx);

  if (!subscribed) {
    return ctx.answerCbQuery("Siz hali obuna bo‘lmagansiz!", { show_alert: true });
  }

  await ctx.deleteMessage().catch(() => {});
  return ctx.reply("Ish joyini tanlang:", mainMenuKeyboard());
});

bot.hears("HDP LC", async (ctx) => {
  const subscribed = await checkSubscription(ctx);
  if (!subscribed) {
    return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
  }

  db.run(`UPDATE users SET hdp = hdp + 1 WHERE user_id = ?`, [ctx.from.id], (err) => {
    if (err) console.error("HDP update error:", err.message);
  });

  return ctx.reply("HDP LC uchun forma:", Markup.inlineKeyboard([
    [Markup.button.url("Formani ochish", "https://forms.gle/f6ZiQtiqCAH1CLy87")],
  ]));
});

bot.hears("Omon School", async (ctx) => {
  const subscribed = await checkSubscription(ctx);
  if (!subscribed) {
    return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
  }

  db.run(`UPDATE users SET omon = omon + 1 WHERE user_id = ?`, [ctx.from.id], (err) => {
    if (err) console.error("Omon update error:", err.message);
  });

  return ctx.reply("Omon School uchun forma:", Markup.inlineKeyboard([
    [Markup.button.url("Formani ochish", "https://forms.gle/97m9hCsBFovYKKrX7")],
  ]));
});

bot.command("admin", async (ctx) => {
  if (!ADMIN_ID || ctx.from.id !== ADMIN_ID) return;

  db.get(`SELECT COUNT(*) as total FROM users`, (err, usersRow) => {
    if (err) return console.error(err.message);

    db.get(`SELECT SUM(hdp) as total_hdp, SUM(omon) as total_omon FROM users`, (err2, clicksRow) => {
      if (err2) return console.error(err2.message);

      ctx.reply(`📊 Statistika:\n\n👥 Foydalanuvchilar: ${usersRow.total || 0}\n\n🔹 HDP LC bosilgan: ${clicksRow.total_hdp || 0}\n🔹 Omon School bosilgan: ${clicksRow.total_omon || 0}`);
    });
  });
});

// ================= WEBHOOK & SERVER START =================
async function start() {
  try {
    if (WEBHOOK_HOST) {
      // mount telegraf webhook handler
      app.use(bot.webhookCallback('/webhook'));

      // set webhook with Telegram
      await bot.telegram.setWebhook(`${WEBHOOK_HOST.replace(/\/$/,"")}/webhook`);

      // start express
      const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
      });

      // graceful shutdown for webhook server
      const shutdown = () => {
        console.log('Shutting down...');
        server.close(() => {
          db.close(() => process.exit(0));
        });
      };

      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    } else {
      // fallback to long polling for local development
      await bot.launch();
      console.log('Bot launched using long polling (no WEBHOOK_HOST set).');

      const shutdown = async () => {
        console.log('Shutting down...');
        try { await bot.stop(); } catch (e) {}
        db.close(() => process.exit(0));
      };

      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    }
  } catch (err) {
    console.error('Failed to start server or set webhook:', err.message);
    process.exit(1);
  }
}

start();
