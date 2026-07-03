# Personal API relay (optional, any provider)

Zine works out of the box through shared public CORS relays, but those are
free community services — they rate-limit and have bad days. A personal
relay is a ~30-line function on any free serverless host; it forwards API
requests to `api.mangadex.org` server-side (no CORS there) and hands the
response back with permissive headers. Deploy ONE of these, then paste its
URL into **Settings → Content → API proxy**:

| File | Provider | Deploy in short |
| --- | --- | --- |
| `worker.js` | Cloudflare Workers | dash.cloudflare.com → Workers → Create → paste |
| `deno.ts` | Deno Deploy | dash.deno.com → New Playground → paste → Deploy |
| `vercel.mjs` | Vercel | drop into `api/[...path].mjs` of any repo → import to vercel.com |
| `netlify.mjs` | Netlify | drop into `netlify/edge-functions/mangadex.mjs` → deploy repo |

All of them are equivalent — pick whichever service you already have an
account on. Free tiers are far beyond what one reader ever needs.
