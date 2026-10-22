// Strava sync: a Supabase Edge Function that connects a person's Strava account and copies their
// Strava activities into the Exercise module (table `workouts`).
// It runs on Supabase, not in the browser, so the Strava "Client Secret" and the Strava tokens are never
// visible to the app page. The tokens live in table `strava_tokens`, which the app itself cannot read.
//
// Needs two secrets (Supabase → Edge Functions → Secrets): STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.
// The app calls it with { action: "status" | "connect" | "sync" | "disconnect" } while logged in.
import { createClient } from "npm:@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// The first sync copies this many days back; later syncs only fetch activities newer than the last one
const FIRST_SYNC_DAYS = 90;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Strava activity kinds -> the app's activity names and the body areas they usually train
const KINDS: Record<string, [string, string[]]> = {
  Ride: ["Cycling", ["Cardio"]], VirtualRide: ["Cycling", ["Cardio"]], EBikeRide: ["Cycling", ["Cardio"]],
  MountainBikeRide: ["Cycling", ["Cardio"]], GravelRide: ["Cycling", ["Cardio"]], EMountainBikeRide: ["Cycling", ["Cardio"]],
  Run: ["Running", ["Cardio"]], TrailRun: ["Running", ["Cardio"]], VirtualRun: ["Running", ["Cardio"]],
  Walk: ["Walk", ["Cardio"]], Hike: ["Hiking", ["Cardio", "Legs"]],
  Swim: ["Swimming", ["Cardio"]], WeightTraining: ["Weights", []], Yoga: ["Yoga", ["Core"]],
  Badminton: ["Badminton", ["Cardio"]], Workout: ["Workout", []], Elliptical: ["Elliptical", ["Cardio"]],
  StairStepper: ["Stair stepper", ["Cardio", "Legs"]], Rowing: ["Rowing", ["Cardio", "Back"]],
  VirtualRow: ["Rowing", ["Cardio", "Back"]], Crossfit: ["Crossfit", ["Cardio"]], HighIntensityIntervalTraining: ["HIIT", ["Cardio"]],
  Pilates: ["Pilates", ["Core"]], Tennis: ["Tennis", ["Cardio"]], Soccer: ["Football", ["Cardio", "Legs"]]
};
function kindOf(sport: string): [string, string[]] {
  if (KINDS[sport]) return KINDS[sport];
  // "TableTennis" -> "Table tennis"
  const words = sport.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return [words.charAt(0).toUpperCase() + words.slice(1), []];
}

// Ask Strava for tokens, with a plain error when it says no
async function stravaToken(params: Record<string, string>) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Strava refused the login (" + (data.message || res.status) + ").");
  return data;
}

// A working access token for this person, refreshed when it has expired (Strava tokens last 6 hours)
async function accessToken(row: Record<string, any>) {
  if (row.expires_at > Date.now() / 1000 + 60) return row.access_token;
  const t = await stravaToken({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  const { error } = await admin.from("strava_tokens").update({
    access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at
  }).eq("user_id", row.user_id);
  if (error) throw new Error(error.message);
  return t.access_token;
}

async function sync(userId: string) {
  const { data: row, error } = await admin.from("strava_tokens").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Strava isn't connected yet.");
  const token = await accessToken(row);
  const after = row.synced_until ?? Math.floor(Date.now() / 1000) - FIRST_SYNC_DAYS * 86400;

  // Strava gives at most 200 activities per page
  const activities: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200&page=${page}`,
      { headers: { Authorization: "Bearer " + token } });
    if (res.status === 429) throw new Error("Strava is busy (too many requests). Try again in 15 minutes.");
    if (!res.ok) throw new Error("Strava didn't send the activities (" + res.status + ").");
    const list = await res.json();
    activities.push(...list);
    if (list.length < 200) break;
  }

  const rows = activities.map(a => {
    const [type, areas] = kindOf(a.sport_type || a.type || "Workout");
    return {
      user_id: userId,
      strava_id: a.id,
      date: String(a.start_date_local).slice(0, 10),
      type,
      duration_min: Math.max(1, Math.round((a.moving_time || a.elapsed_time || 0) / 60)),
      intensity: "moderate",
      body_parts: areas,
      distance_km: a.distance ? Math.round(a.distance / 10) / 100 : null,
      note: String(a.name || "").slice(0, 200)
    };
  });
  let added = 0;
  if (rows.length) {
    // An activity that is already in the app is left as it is, so your own edits to it are kept
    const { data, error: e } = await admin.from("workouts")
      .upsert(rows, { onConflict: "user_id,strava_id", ignoreDuplicates: true }).select("id");
    if (e) throw new Error(e.message);
    added = data?.length ?? 0;
  }
  const newest = activities.reduce((m, a) => Math.max(m, Math.floor(Date.parse(a.start_date) / 1000)), after);
  const now = new Date().toISOString();
  await admin.from("strava_tokens").update({ synced_until: newest, last_sync_at: now }).eq("user_id", userId);
  return { added, found: activities.length, last_sync_at: now };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return reply({ error: "The Strava secrets aren't set yet (STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET)." }, 500);
    }
    // Who is calling: the app sends the logged-in person's session
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return reply({ error: "Please log in again." }, 401);
    const { action, code } = await req.json().catch(() => ({}));

    if (action === "status") {
      const { data: row, error } = await admin.from("strava_tokens")
        .select("athlete_name, last_sync_at").eq("user_id", user.id).maybeSingle();
      if (error) throw new Error(error.message);
      return reply({ client_id: CLIENT_ID, connected: Boolean(row), athlete_name: row?.athlete_name, last_sync_at: row?.last_sync_at });
    }

    if (action === "connect") {
      if (!code) return reply({ error: "Strava didn't send a login code." }, 400);
      const t = await stravaToken({ grant_type: "authorization_code", code });
      const name = [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(" ");
      const { error } = await admin.from("strava_tokens").upsert({
        user_id: user.id, athlete_id: t.athlete?.id, athlete_name: name,
        access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at
      });
      if (error) throw new Error(error.message);
      return reply({ connected: true, athlete_name: name, ...(await sync(user.id)) });
    }

    if (action === "sync") return reply(await sync(user.id));

    if (action === "disconnect") {
      const { data: row } = await admin.from("strava_tokens").select("*").eq("user_id", user.id).maybeSingle();
      if (row) {
        // Tell Strava too, so the app disappears from your Strava settings; workouts already copied stay
        try {
          const token = await accessToken(row);
          await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: "Bearer " + token } });
        } catch { /* still disconnect here */ }
        await admin.from("strava_tokens").delete().eq("user_id", user.id);
      }
      return reply({ connected: false });
    }

    return reply({ error: "Unknown action." }, 400);
  } catch (err) {
    return reply({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
