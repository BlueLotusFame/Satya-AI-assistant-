# SatyaAI Assistant

A starter AI assistant that runs as an app-like website and can be installed on supported phones/desktops as a PWA.

## What it does
- Chat UI with a responsive mobile layout
- Local chat history saved in the current browser
- Optional live web search using the OpenAI Responses API
- Source links shown when the API returns web citations
- Installable app shell on supported browsers
- API key stays on the server, not in frontend code
- Basic security headers and request rate limiting

## Important
- This is a starter project, not a finished commercial service.
- AI replies require internet access and a valid API key.
- API use and live web search may cost money. Check your API account pricing/limits before using it.
- A ChatGPT subscription does not automatically include API credits.
- Never upload your `.env` file or share your API key.
- PWA installation works best when deployed over HTTPS. `localhost` is allowed for local development.
- The app shell may open offline, but AI chat and live web search do not work without internet.

## Setup on Windows
1. Install Node.js LTS from the official Node.js website: https://nodejs.org/
2. Extract this ZIP to a folder, for example `C:\SatyaAI_Assistant`.
3. Open PowerShell in that folder.
4. Run:
   ```powershell
   npm install
   ```
5. Copy `.env.example` to `.env`.
6. Open `.env` and set `OPENAI_API_KEY` to your own API key. Do not put quotes around it.
7. If the configured model is not available to your API account, change `OPENAI_MODEL` to a model your account supports.
8. Start the app:
   ```powershell
   npm start
   ```
9. Open `http://localhost:3000` in your browser.

## Install as an app
- For local testing, open the site in a supported browser on the same device.
- For installation on another device, deploy the project to a secure HTTPS host. Keep the API key in the host's server environment variables, not in frontend files.
- Do not expose the server publicly without adding authentication, stronger abuse controls, and appropriate hosting configuration.

## Troubleshooting
- `API key needed`: create `.env` from `.env.example`, add your key, and restart `npm start`.
- `API key was rejected`: verify the key and that the API account is enabled.
- `rate limit or account quota`: check API limits and billing.
- `model name`: set `OPENAI_MODEL` to a model enabled for your account.
- `EADDRINUSE`: another process is using port 3000; stop it or choose a different `PORT` in `.env`.

## Project structure
- `server.js` — backend and AI API integration
- `public/index.html` — app layout
- `public/styles.css` — responsive styling
- `public/app.js` — chat UI, history, and install prompt
- `public/manifest.webmanifest` — installable app metadata
- `public/sw.js` — app-shell caching
