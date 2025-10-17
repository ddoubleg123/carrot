# Techpulse (static site)

A simple, static homepage for Techpulse.

## Structure
- `index.html` — homepage markup
- `styles.css` — minimal responsive styles
- `assets/logo-temp.svg` — temporary logo (symbol + wordmark in one)

## Messaging
Techpulse has built a proprietary AI after over 20 years in the automobile service industry. Our AI — named Synth — is able to better diagnose core issues plaguing cars better than traditional diagnostics services.

Synth works with traditional diagnostics providers like Snap‑On and others but provides better root cause analysis, saving you and your customers time and money.

## Pricing
- Pay per use: $75
- Monthly unlimited: $350

## Run locally
No build step required. Open `techpulse/index.html` in your browser.

Optionally use a lightweight server to test on `http://localhost`:

```bash
# Python 3
python -m http.server 5500 --directory techpulse

# or Node (if you have serve installed)
npx serve techpulse -l 5500
```
