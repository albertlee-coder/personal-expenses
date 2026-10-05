# Personal Expenses app

A simple web app that runs in your browser. No installation, no server, no account.

## How to open it
- Live website: https://albertlee-coder.github.io/personal-expenses/ (GitHub Pages, updates on every push to `main`)
- Online: https://claude.ai/artifact/SVSiXdLEJASAaxswymJuaG (private to you)
- On your computer: download `index.html` from this folder and double-click it.

## How it's built
- Everything is in one file, `index.html`: page layout (HTML), styling (CSS) and behaviour (JavaScript).
- Expenses are saved in your browser's local storage (key `personal-expenses-v1`). They stay on that device
  and in that browser only. The online link and the downloaded file each keep their own separate data.
- Categories are edited in the Categories tab and saved under key `personal-expenses-categories-v1`.
- The app has three tabs: Expenses, Dashboard (spending by month and by category) and Categories.
- Currency is set by `CURRENCY` near the top of the script (set to `IDR`, Indonesian rupiah, shown like Rp 150.000).

## Plan
1. Set up the app (done)
2. Record expenses: add, edit, delete (done)
3. Analyze spending: dashboard by month and by category (done), plus your own categories
4. Import a bank CSV and export a backup
