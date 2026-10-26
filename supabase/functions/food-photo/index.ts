// Food photo: a Supabase Edge Function that looks at a photo of a food, a drink or a nutrition label
// and returns its name, serving and numbers per serving, for the Meals › My foods form.
// It runs on Supabase, not in the browser, so the Anthropic API key is never visible to the app page.
//
// Needs one secret (Supabase → Edge Functions → Secrets): ANTHROPIC_API_KEY.
// The app calls it while logged in with { image: <base64 JPEG>, media_type: "image/jpeg" }.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const client = new Anthropic({ apiKey: API_KEY });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// The answer always has exactly these fields (structured output), so the app can fill its form directly
const num = { type: "number" };
const SCHEMA = {
  type: "object",
  properties: {
    recognized: { type: "boolean" },
    name: { type: "string" },
    serving: { type: "string" },
    kind: { type: "string", enum: ["food", "drink"] },
    sugar_g: num, carbs_g: num, sat_fat_g: num, cholesterol_mg: num, protein_g: num,
    source: { type: "string", enum: ["label", "estimate"] },
    note: { type: "string" }
  },
  required: ["recognized", "name", "serving", "kind", "sugar_g", "carbs_g", "sat_fat_g", "cholesterol_mg", "protein_g", "source", "note"],
  additionalProperties: false
};

const PROMPT = `This photo is for a personal food diary in Indonesia. It shows a food or drink, or the nutrition label
("Informasi Nilai Gizi") of a packaged product.

Give the numbers for ONE serving:
- If a nutrition label is readable, copy its per-serving values ("per sajian"): Gula -> sugar_g, Karbohidrat total ->
  carbs_g, Lemak jenuh -> sat_fat_g, Kolesterol -> cholesterol_mg, Protein -> protein_g. Use the label's serving size
  for "serving" (e.g. "1 botol (250 ml)") and set source to "label".
- Otherwise estimate from what you see, for the portion in the photo, using typical Indonesian recipes, and set
  source to "estimate". Count cooking oil, coconut milk (santan), sugar and sweet soy sauce you can reasonably expect.
- "name" is short, in the language people would use for it in Indonesia (e.g. "Nasi goreng ayam", "Teh botol Sosro").
- "note" is one short English sentence on what you assumed (portion, ingredients), or "" when you copied a label.
- If the photo shows no food, drink or label, set recognized to false, use "" and 0 for the rest, and say why in note.
Use 0 for a value that is truly zero or unknown on a label. Round to one decimal.`;

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!API_KEY) return reply({ error: "The ANTHROPIC_API_KEY secret isn't set yet on Supabase." }, 500);
    // Who is calling: the app sends the logged-in person's session, so strangers can't spend the credit
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return reply({ error: "Please log in again." }, 401);

    const { image, media_type } = await req.json().catch(() => ({}));
    if (typeof image !== "string" || !image) return reply({ error: "No photo was sent." }, 400);
    if (image.length > 5_000_000) return reply({ error: "The photo is too large." }, 400);
    const type = ["image/jpeg", "image/png", "image/webp"].includes(media_type) ? media_type : "image/jpeg";

    // fallbacks: if the model declines the request, the API retries it on another model in the same call
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: type, data: image } },
          { type: "text", text: PROMPT }
        ]
      }]
    } as any);

    if (response.stop_reason === "refusal") return reply({ error: "The photo couldn't be read. Try another photo." }, 422);
    if (response.stop_reason === "max_tokens") return reply({ error: "The answer was cut off. Try again." }, 502);
    const text = response.content.find((b: any) => b.type === "text") as any;
    if (!text) return reply({ error: "No answer came back. Try again." }, 502);
    return reply(JSON.parse(text.text));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return reply({ error: "The Anthropic API key is wrong. Check the ANTHROPIC_API_KEY secret." }, 500);
    if (err instanceof Anthropic.RateLimitError) return reply({ error: "Too many photos at once. Wait a minute and try again." }, 429);
    if (err instanceof Anthropic.APIError) {
      const low = /credit|balance|billing/i.test(err.message);
      return reply({ error: low ? "The Anthropic account has no credit left. Top it up at console.anthropic.com." : `Anthropic error ${err.status}: ${err.message}` }, 502);
    }
    return reply({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
