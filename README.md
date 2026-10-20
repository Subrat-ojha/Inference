# Inference

An authenticated inference and Java learning roadmap backed by Neon Postgres,
Neon Auth, and a Neon Function.

## Local development

```bash
npm install
npm run dev
```

## Netlify

This repository includes `netlify.toml`, so Git-based Netlify deployments use:

- Build command: `npm run build`
- Publish directory: `dist`
- Node.js 22
- An SPA fallback to `index.html`

Production browser requests use same-origin `/api/neon-auth` and `/api/tracker`
proxies declared in `netlify.toml`. This avoids client-side DNS failures for
Neon's service subdomains while preserving Neon Auth cookies and authorization
headers. Another host must provide equivalent proxy routes or override
`VITE_NEON_AUTH_URL` and `VITE_TRACKER_API_URL` with reachable public endpoints.

For sign-in on a production domain, add its exact `https://...` origin to the
trusted domains for the Neon Auth configuration.
