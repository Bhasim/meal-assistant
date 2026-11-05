# Meal Assistant — وجباتي

An Arabic, right-to-left nutrition tracker designed to support **personalized meal planning for people with type 2 diabetes**. Local-first, responsive, dependency-free HTML/CSS/JavaScript.

## Open the app

- **Portable file:** open `Meal-Assistant.html` in a web browser. No installation or account is required for manual tracking. On a phone, save the document and open it in a full browser; messaging-app previews may not execute JavaScript.
- **Source version:** open `index.html`, or serve the directory using `python3 -m http.server 8080` and visit `http://localhost:8080`.
- **GitHub Pages:** publish this directory with `index.html` at its root. No build step is required for static use; the optional Claude relay requires `server.py` on a trusted local computer. Repository: [Bhasim/meal-assistant](https://github.com/Bhasim/meal-assistant). GitHub Pages is configured from the repository settings.
- Rebuild the portable HTML and source ZIP with `python3 build.py` after source changes.

## What is included

- A daily dashboard for calories, total carbohydrates, total sugars and added sugars.
- A meal builder with adjustable quantities, a small **approximate** plain-food reference list, and custom nutrition input.
- A nutrition-label calculator supporting grams or millilitres, arbitrary printed reference portions, and multiple portions. It does not assume 1 ml = 1 g.
- Optional daily calorie/carbohydrate/added-sugar targets, and optional carbohydrate targets for each meal type. No universal diabetes targets or arbitrary natural-sugar cap are imposed.
- A diary with all nutrient totals, ingredient details, a seven-day table, CSV export and validated JSON backup/restore.
- Reference-inspired forest/charcoal styling, lime-to-turquoise gradients, a floating mobile navigation bar, native SVG icons, circular progress, photographic meal templates, light/dark/system themes, keyboard labels and visible focus styles. Templates add editable estimated ingredients; they never log meals automatically.
- Optional migration from the original app's `mealapp` localStorage key when both apps share an origin. The original key is retained. Data from unrelated file paths or browsers is not automatically accessible.

## Calculation rules

`consumed nutrient = printed nutrient × consumed amount ÷ printed reference amount`

Each ingredient retains its original reference quantity and unit. The app sums the scaled ingredients once. Sugars are part of carbohydrates and are **never added a second time**. Fibre is displayed separately and is not subtracted automatically. A carbohydrate counting unit is approximately 15 g, displayed as arithmetic information rather than a prescribed intake.

Added sugar and fibre can be **unknown**. Missing values are not converted to a claim of zero: the interface shows an unknown value, or a partial known total. CSV leaves incomplete optional totals blank; JSON retains ingredient-level detail. Targets set to zero (e.g. an optional added-sugar limit) remain zero rather than being replaced with a default.

The built-in food list is a convenience estimate for plain foods, not a certified food composition database. Brands, recipes, cooking and edible portions vary. Use the actual nutrition label or values verified by a dietitian for precision.

## Independent image analysis — your provider, your key

The original `claude.use('sample')` dependency has been removed. Open **خطتي وبياناتي → خدمة تحليل الصور**, choose a provider and enter an API key (not your account password). No service is required for manual calculations.

1. **OpenRouter free models (first option):** create a key at [OpenRouter](https://openrouter.ai/settings/keys), leave the model as `openrouter/free`, and approve sending the selected image. The adapter accepts only `openrouter/free` or model IDs ending in `:free`; it never falls back to paid models. The free router supports image requests and selects a compatible available free model. Availability, quality and quotas vary. This is a practical trial option, not a clinically validated nutrition service.
2. **Google Gemini:** create a key at [Google AI Studio](https://aistudio.google.com/api-keys). The editable initial model is `gemini-2.5-flash`. Check the current available model, account quota, billing and regional terms. A free tier exists for eligible use, but it is **not guaranteed for every region or deployment**, particularly applications made available in the EEA/UK/Switzerland. Free-tier data handling differs from paid usage. The app does not enable billing or guarantee a free request.
3. **Claude API:** create your own Console API key and set up API access/credits. A Claude chat subscription is not automatically an API allowance. Run `python3 server.py`, visit the printed local URL (default `http://127.0.0.1:8768`), and enter the key in the app. The bundled loopback-only server relays image requests to Anthropic's fixed Messages API endpoint. There are no Python package dependencies. A plain HTML file on GitHub Pages cannot provide this local relay; use OpenRouter/Gemini there, or deploy an authenticated backend separately.

The API key remains **only in the current page's in-memory session**. It is not written to localStorage, JSON backups, CSV, application source or the ZIP. The key field clears after configuring the session. Reloading the page requires reconfiguration. Disconnect clears the app's in-memory key; revoke the key at the provider if you need account-level revocation. This bring-your-own-key mode is intended for the user's trusted personal copy, not for placing a shared secret in a public website. Use the local server for Claude; no dangerous direct-browser Anthropic flag is used.

Each analysis sends only the compressed selected image and a generic food/label prompt to the selected provider (and, for OpenRouter, its selected model provider). Personal goals, diary history, age, medication or health profile are not sent. Photos are re-encoded before transmission to remove embedded camera metadata. No image is sent on upload/preview or service configuration. Requests can be subject to the provider's storage/training policies and quotas; the UI includes explicit consent and links to account setup. Do not send sensitive images without reviewing those policies.

Model output is parsed and validated. The app rejects invalid nutrient relationships and malformed responses. Meal estimates require review before adding them; label readings populate the form for review rather than saving automatically. Unknown added sugar remains unknown. These models cannot reliably determine food weight, recipe ingredients or added sugar from a photograph alone; manually verify the quantity and label.

The request adapters and local relay were tested with mocked provider responses and test-only placeholder keys. **No real paid/free API inference or clinical accuracy benchmark was run**, because no provider key was supplied. Model IDs and free quotas can change; the model field is editable.

Official references reviewed November 5, 2026:

- [OpenRouter free models and limits](https://openrouter.ai/collections/free-models)
- [OpenRouter free image-capable router](https://openrouter.ai/openrouter/free/apps)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [terms](https://ai.google.dev/gemini-api/terms)
- [Claude API and chat-plan billing](https://support.claude.com/en/articles/9876003-why-is-claude-api-usage-billed-separately-from-my-paid-claude-plan)
- [Claude vision API](https://platform.claude.com/docs/en/build-with-claude/vision)

## Data and privacy

Meals and goals are stored in the current browser's localStorage, not in an account or cloud database. Images are kept only in session memory and are not saved in the diary, backups or archive. Private browsing, clearing site data, file relocation or using another browser can lose access to data. Export JSON backups regularly. Restore replaces the current diary and goals only after confirmation.

No Telegram credential, personal health profile, sample meal history, original user's identifiers or analytics is embedded in these files. Telegram delivery is performed externally by the existing local bot, not from the app.

## Clinical scope and references

This is an educational food-recording tool, **not a medical device or individualized treatment prescription**. It does not predict glucose, certify a food as safe/dangerous, calculate insulin doses, or change medication. Set nutrition targets with the care team; appropriate carbohydrate intake varies by individual and treatment. Photo estimates should not guide medication decisions.

Sources reviewed November 5, 2026:

- [CDC — Carb Counting](https://www.cdc.gov/diabetes/healthy-eating/carb-counting-manage-blood-sugar.html)
- [CDC — Diabetes Meal Planning](https://www.cdc.gov/diabetes/healthy-eating/diabetes-meal-planning.html)
- [ADA — Carb Counting and Diabetes](https://diabetes.org/food-nutrition/understanding-carbs/carb-counting-and-diabetes)

## Validation

Run `node test.mjs`, `node test_ai.mjs` (Node.js 18+), and `python3 -m unittest test_server.py` (Python 3.9+). It checks serving arithmetic, unit preservation, missing values, nutrient validation, zero targets, malformed backups and ingredient-derived totals. The browser workflow also checks label-to-meal-to-diary flow, local persistence, responsive layouts and themes. Arithmetic tests do not constitute clinical validation.

Version: **2.1.0**

## Photography

The two user-supplied screenshots were used as visual direction, not as embedded application screens. Real photos are bundled locally and inlined into the portable HTML, so the interface does not request image tracking URLs on startup.

- Broccoli: [Juairia Islam Shefa / Unsplash](https://unsplash.com/photos/a-close-up-of-a-broccoli-plant-with-leaves-K6v0k4MfqvM)
- Avocado toast: [Nahima Aparicio / Unsplash](https://unsplash.com/photos/a-plate-of-food-with-an-egg-on-top-of-it-t3pjRI7oql4)
- Breakfast bowl: [picjumbo — free yogurt photography](https://picjumbo.com/free-photos/yogurt/)

Photos are illustrative; displayed nutrition is calculated from the editable template quantities, not inferred from the stock photo. The breakfast photo may show toppings not included in the template; review your actual ingredients.
