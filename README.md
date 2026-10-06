# Yalla Ball Web Shop

Xsolla AI Toolkit Phase 1: a read-only catalog of existing virtual items, currency packages, and bundles from project 316922.

Requires Node.js 18 or newer. Run `npm run dev`, then open the localhost URL printed in the terminal.

Optional shell variables: `XSOLLA_PROJECT_ID`, `XSOLLA_LOCALE` (defaults to `en`), and `PORT` (defaults to `5173`). No credentials are required. Prices and availability are resolved by Xsolla from the browser's IP address.

BUY opens hosted sandbox Pay Station for one existing SKU. Checkout requires `XSOLLA_PROJECT_API_KEY` in the server environment; it is never sent to the browser. The server uses the official Store API v3 payment-token endpoint with `sandbox: true`. A persistent browser-generated ID identifies the local test buyer.

For sandbox checkout only, the local server resolves and caches its public IPv4 address via ipify. Set `XSOLLA_DEV_USER_IP` to provide it explicitly. There is no Login or fulfillment integration.
