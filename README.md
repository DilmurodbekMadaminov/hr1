# HR Telegram Bot (Telegraf + Webhook + SQLite)

This repository contains a production-ready HR bot using Telegraf with Telegram Webhook and SQLite for basic analytics.

Features
- Webhook-based (no long polling)
- BOT_TOKEN and WEBHOOK_HOST taken from environment variables
- Channel subscription enforcement
- Inline & reply keyboards
- SQLite statistics and simple admin command

Quick start (PowerShell)

```powershell
$env:BOT_TOKEN = "your_bot_token"
$env:WEBHOOK_HOST = "https://your-app.onrender.com"
# optional
$env:CHANNEL_USERNAME = "@Xorazm_ish_bozor1"
$env:ADMIN_ID = "7858117466"

npm install
npm start

Troubleshooting
1. Missing env or immediate exit: ensure you created a `.env` file or set environment variables. You can copy `.env.example` and fill values.
2. Webhook not reachable: if running locally use `ngrok` to expose a public URL, or deploy to Render/Heroku.
3. Permission errors when checking channel subscription: add the bot as an administrator in the channel or set the correct `CHANNEL_USERNAME`.

If you see the process exit immediately with code 1, check the terminal message — it will tell which env vars are missing.
```

Deploy to Render
1. Push repo to GitHub
2. Create a new Web Service on Render (Environment: Node)
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables on Render: `BOT_TOKEN`, `WEBHOOK_HOST` (no trailing slash), optionally `CHANNEL_USERNAME` and `ADMIN_ID`.

Next steps you can ask me to do:
- Add a small admin panel with inline controls
- Export stats to CSV/Excel
- Add Dockerfile / PostgreSQL migration
