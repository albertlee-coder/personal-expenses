# Personal Superapp

A personal web app with several modules in one place: **To-do**, **Expenses**, **Meals**, **Exercise** and **Body**,
plus a **Home** screen that shows your open tasks and today's numbers from every module.
It runs in the browser: no installation.

## How to open it
- Live website: https://albertlee-coder.github.io/personal-expenses/ (GitHub Pages, updates on every push to `main`)
- On your computer: download the whole folder and open `index.html`.

## Login and separate data (Supabase)
- With `SUPABASE_URL` and `SUPABASE_KEY` filled in near the top of `js/core.js`, the app asks everyone to log in
  with email and password, and each person only sees their own data.
- The database tables and the rules that keep each person's data private are in `supabase-setup.sql`.
  Run it in Supabase → SQL Editor after every update that adds tables. It is safe to re-run and never deletes data.
- With both values empty, the app works without login and keeps data in the browser.

## Modules
- **Home**: add and tick off tasks without opening To-do, and one card per module with today's numbers.
- **To-do**: tasks with an optional due date, grouped as Overdue, Today, Coming up and No date.
- **Expenses**: record spending (amount, date, category, payment method), a dashboard by month, by day and by
  category, and your own lists of categories and payment methods. Currency is set by `CURRENCY` in `js/core.js` (IDR).
- **Meals**: record what you eat and drink with rough sugar, carbohydrate, saturated fat, cholesterol and protein numbers.
  *My foods* holds the foods you usually have (a starting list of common Indonesian foods is added for new accounts).
  The *Monthly report* says whether the month leaned high in sugar or in cholesterol, compared with common daily
  guidelines (WHO and heart-health advice), and whether it was low in protein (goal 60 g a day, from Indonesia's AKG). The numbers are estimates, not medical advice.
- **Exercise**: record workouts (activity, minutes, how hard, body areas), an optional weekly plan, and a week check
  with suggestions: active minutes (150 a week), strength days (2 a week), areas not trained yet and missed plan days.
- **Body**: record the 8 numbers from a body-composition scale (weight, body fat %, muscle %, visceral fat level,
  protein %, body water %, bone mass, skeletal muscle %). Each one is marked *below normal*, *normal* or *above normal*
  for your profile (height, birth date, sex, ethnicity), and the *Progress* tab charts each number over time with
  its normal range shaded. Ranges: BMI 18.5–22.9 for Asian people and 18.5–24.9 for others (weight); Gallagher 2000
  for body fat by age, sex and ethnicity; muscle = what remains after a healthy body fat and typical bone mass;
  visceral fat 1–9; protein 16–20%; body water 50–65% (men) / 45–60% (women); typical bone mass ±10% by sex and
  weight (Tanita); skeletal muscle by age and sex (Omron). The ranges live in `INDICATORS` in `js/body.js`.

## Strava sync (Exercise)
Each person can connect their own Strava account on the Exercise → Record screen. Activities (rides, runs, walks…)
are copied in as workouts: activity, date, moving minutes, distance and the Strava title as the note. The first sync
copies the last 90 days; after that, opening the app copies new activities (at most every 15 minutes), or press
*Sync now*. Synced workouts can be edited or deleted like any other and are never added twice.
The *Strava month* tab sums one month of Strava activities per activity (Cycling, Running, Walk…): number of
activities and days, moving time, distance, average speed (or pace for running and walking), longest activity,
climbing and average heart rate, compared with the month before.
After changing `supabase/functions/strava/index.ts`, paste it into the `strava` function again and deploy.

The Strava login runs in a Supabase Edge Function (`supabase/functions/strava/index.ts`), so the Strava secret and
tokens never reach the browser. Tokens are kept in table `strava_tokens`, which only that function can read.

One-time setup:
1. strava.com/settings/api: create an API application. Website: the app's address. Authorization Callback Domain:
   `albertlee-coder.github.io`. Note the Client ID and Client Secret.
2. Supabase → SQL Editor: run the latest `supabase-setup.sql`.
3. Supabase → Edge Functions → Secrets: add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`.
4. Supabase → Edge Functions → Deploy a new function → Via Editor: name it `strava`, paste
   `supabase/functions/strava/index.ts`, deploy. In its settings, turn off "Verify JWT" (the function checks the
   login itself).

New Strava API applications accept only the account that created them; Strava has to raise that limit before a
second person can connect.

## Food photos (Meals → My foods)
*Fill in from a photo* on the My foods form sends a photo of a food, a drink or a nutrition label to Claude
(Anthropic's AI) through the Supabase Edge Function `supabase/functions/food-photo/index.ts`. Claude returns the
name, serving and numbers per serving; the app fills the form, and nothing is saved until you tap *Add food*.
Labels are copied; dishes are estimates. The photo is shrunk to 1024 px first; each photo costs a few cents of
Anthropic API credit.

One-time setup:
1. console.anthropic.com: create an account, add credit (Billing), and create an API key.
2. Supabase → Edge Functions → Secrets: add `ANTHROPIC_API_KEY`.
3. Supabase → Edge Functions → Deploy a new function → Via Editor: name it `food-photo`, paste
   `supabase/functions/food-photo/index.ts`, deploy. In its settings, turn off "Verify JWT" (the function checks
   the login itself).

## How it's built
- `index.html` is the page shell (header, login, module bar). `css/app.css` holds all styling.
- `js/core.js` holds the shared parts: settings, login, helpers, moving between modules, and `Table`,
  which saves a list of records online or in the browser.
- Each module is one file in `js/` that calls `defineModule(...)` with its screen and hooks (load, render, home card).
- To add a module later: write `js/<name>.js`, add a `<script>` line for it in `index.html`, give it an icon in
  `ICONS` in `js/core.js`, and add its tables to `supabase-setup.sql`.
- When a file changes, raise the `?v=` number on its line in `index.html` so browsers fetch the new version.
