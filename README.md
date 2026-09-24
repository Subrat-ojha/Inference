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

The public Neon Auth and tracker API endpoints have deployment-safe defaults.
They can be overridden with `VITE_NEON_AUTH_URL` and
`VITE_TRACKER_API_URL` in Netlify's environment variables.

For sign-in on a production Netlify domain, add the site's exact `https://...`
origin to the trusted domains for the Neon Auth configuration.
