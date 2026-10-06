# Yalla Ball Web Shop

Xsolla AI Toolkit Phase 1: a read-only catalog of existing virtual items, currency packages, and bundles from project 316922.

Requires Node.js 18 or newer. Run `npm run dev`, then open the localhost URL printed in the terminal.

Optional shell variables: `XSOLLA_PROJECT_ID`, `XSOLLA_LOCALE` (defaults to `en`), and `PORT` (defaults to `5173`). No credentials are required. Prices and availability are resolved by Xsolla from the browser's IP address.

BUY opens hosted sandbox Pay Station for one existing SKU. Checkout requires `XSOLLA_PROJECT_API_KEY` in the server environment; it is never sent to the browser. The server uses the official Store API v3 payment-token endpoint with `sandbox: true`. A persistent browser-generated ID identifies the local test buyer.

For sandbox checkout only, the local server resolves and caches its public IPv4 address via ipify. Set `XSOLLA_DEV_USER_IP` to provide it explicitly. There is no Login or fulfillment integration.

## Vercel

Import this repository with Framework Preset "Other". `vercel.json` configures the build command, static output, and API routes. Use Node.js 24.x. `npm run build` copies only `index.html` and `catalog.js` into `dist`; server code and credentials are not public assets.

Configure these server environment variables for each Vercel environment you intend to use:

- `XSOLLA_PROJECT_ID=316922`
- `XSOLLA_PROJECT_API_KEY`: your existing project API key (secret)
- `XSOLLA_LOCALE=en` (optional; defaults to `en`)

Do not prefix credentials with `NEXT_PUBLIC_` or `VITE_`. No merchant ID is required for the current project-level token API. Do not configure `PORT` or `XSOLLA_DEV_USER_IP` on Vercel. Vercel sets `VERCEL=1` automatically; checkout uses Vercel's buyer-IP/country headers rather than the server's egress IP. The HTTPS return URL follows the current shop hostname, including preview deployments.

Checkout remains sandbox-only. The existing Referral Widget loader/configuration is unchanged. Authentication and fulfillment are not implemented. After deployment, verify the widget in a regular browser; its telemetry dependency previously stalled in the Codex in-app browser.
