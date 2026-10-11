# Run Foodie Cards locally on an iPhone

This guide runs the Expo app on your iPhone, the Express backend on your computer, and uses the team's configured hosted Supabase project. You need two terminals running throughout testing. Opening the Expo app does **not** start the backend.

## 1. Prepare your computer and phone

- Install a supported Node.js version (the repository requires Node 22.6 or newer), Git, and Expo Go from the iPhone App Store.
- Connect the computer and iPhone to the same Wi-Fi network. Guest/public Wi-Fi may block communication between devices.
- Use the Supabase project and server credentials supplied securely by the team. Do not paste credentials into chat, screenshots, or Git.
- If Expo Go reports an unsupported SDK, use an Expo Go version compatible with this project's Expo SDK or the team's compatible development build. Do not independently downgrade dependencies.

From your repository folder:

```powershell
git switch main
git pull --ff-only origin main
npm ci
```

Save your existing work before switching branches; do not discard changes to follow this guide. Git does not distribute ignored `.env` files.

## 2. Find your computer's Wi-Fi address

On Windows, run:

```powershell
ipconfig
```

Find **IPv4 Address** under the active Wi-Fi adapter, for example `192.168.1.42`. On macOS, look under System Settings → Wi-Fi → Details → TCP/IP.

Use the address of the computer actually running the backend. Do not use `localhost`, `127.0.0.1`, another teammate's IP, or your router's public internet IP. On an iPhone, `localhost` means the iPhone itself. A VPN/Tailscale address requires a working route on both devices; use the ordinary Wi-Fi address for the simplest setup.

The examples below use `192.168.1.42` and backend port `3000`. Replace the address with yours everywhere. Your address may change when you change networks.

## 3. Configure the two environment files

Create files from the examples only if they do not already exist:

```powershell
if (!(Test-Path mobile/.env)) { Copy-Item mobile/.env.example mobile/.env }
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

Edit **`mobile/.env`**:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PROJECT_PUBLISHABLE_OR_ANON_KEY
EXPO_PUBLIC_API_URL=http://192.168.1.42:3000
```

Edit **`server/.env`**:

```dotenv
PORT=3000
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_PROJECT_SERVICE_ROLE_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=YOUR_VERIFIED_IMAGE_CAPABLE_MODEL
GEMINI_THINKING_LEVEL=low
```

The mobile and server Supabase URLs must point to the **same project**, with that project's matching keys. The project must have the migrations required by your branch applied; see [Supabase setup](setup.md#supabase-project-and-schema). Pulling code does not apply hosted migrations. Coordinate hosted changes with the integration owner.

Keep Gemini and the Supabase service-role key **only on the server**. Never prefix them with `EXPO_PUBLIC_`. Use the team's verified model value; do not guess a model name. The locally tested configuration used `gemini-3.8-flash`, but availability must be verified for your project.

`CORS_ALLOWED_ORIGINS` is needed for browser testing, not ordinary native iPhone requests. If your branch includes public sharing, set its `PUBLIC_BASE_URL` to the phone-reachable backend origin for local link testing; a LAN address is not a public deployment.

### Using local Supabase instead of hosted Supabase

Follow [local Supabase setup](setup.md#supabase-project-and-schema) with Docker running. Do not run `db reset` against data you need to keep: it recreates the local database.

For the phone's `EXPO_PUBLIC_SUPABASE_URL`, replace the local stack's `localhost`/`127.0.0.1` host with the computer's Wi-Fi IP and keep the Supabase API port (usually `54321`). Use the matching local publishable/anon key. The server may use the local stack's loopback API URL and matching service-role key. The phone must be able to reach the Supabase API port as well as the Express and Expo ports.

## 4. Start the backend and prove the phone can reach it

In terminal 1, at the repository root:

```powershell
npm run server
```

Leave this terminal open. The server loads **`server/.env`**. Confirm the startup output's port matches the port in `EXPO_PUBLIC_API_URL`.

On the computer, open `http://localhost:3000/health`. Then, **on the iPhone in Safari**, open:

```text
http://192.168.1.42:3000/health
```

Both must show:

```json
{"ok":true}
```

Do not troubleshoot receipt recognition until the phone's health check works. This check proves Express connectivity, **not** valid Gemini credentials, working Supabase migrations, or successful receipt processing.

If it fails only on the phone:

- Check the IP, backend port, and same Wi-Fi connection.
- In iPhone Settings → Privacy & Security → Local Network, allow Expo Go if listed. Accept its local-network prompt when opening the app.
- On Windows, allow Node.js through Windows Firewall for the trusted private network. Check the inbound backend port without disabling the firewall.
- Check VPN routing and guest-network/client isolation. Try a network that permits communication between your devices.

## 5. Start Expo and open the app

In terminal 2, at the repository root:

```powershell
npm --workspace @foodie-cards/mobile run start -- --lan
```

Scan the displayed QR code with the iPhone Camera and open it in Expo Go. Allow camera access when testing capture; library upload is available separately. Keep both terminals running and the computer awake.

If the Expo bundle itself will not open, check the Expo terminal's displayed host/port and firewall access. A tunnel can help reach the **Expo development server**:

```powershell
npm --workspace @foodie-cards/mobile run start -- --tunnel
```

An Expo tunnel does **not** tunnel the Express backend or local Supabase. Your configured API URLs must still be reachable from the phone. See [Expo's device/network instructions](https://docs.expo.dev/get-started/start-developing/).

## 6. Reload after changing configuration

- **Server settings changed:** stop terminal 1 with Ctrl+C and run `npm run server` again. Do not rely on source-file watch mode to reload `.env` changes.
- **Mobile settings changed:** stop terminal 2 and run `npm --workspace @foodie-cards/mobile run start -- --clear --lan`, then open the new QR code and fully reload the app.
- Existing shell environment variables can override `.env` values. Check for stale values in the process that starts the app; do not print all environment variables or keys into logs.

Expo inlines `EXPO_PUBLIC_` values into the app bundle, so editing a file does not update an already-running bundle by itself. See [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).

## 7. Run a short smoke test

1. Sign up or sign in. Follow email-confirmation instructions if enabled for the project.
2. Open Collection; confirm the backend-unavailable warning is absent.
3. Open Scan and choose a clear receipt photo from the library, then test camera capture separately.
4. Confirm extraction opens an editable draft. Review the restaurant, date, total, items, and quantities before acceptance.
5. Confirm a supported test receipt, inspect the saved card/reveal, and reload the app to verify persistence.
6. Test a review, profile name/avatar, title equipment, and pins on an account with earned cards/titles.
7. Sign out and confirm private account data is no longer visible.

The current acceptance flow may still limit matching to the seeded catalog. Supporting any restaurant is the intended requirement, but that expansion must be implemented and deployed; do not assign a receipt to an unrelated restaurant just to force acceptance. An unsupported restaurant should not cause a network error.

## Troubleshooting receipt uploads

| What you see | What to check next |
| --- | --- |
| `Backend unavailable` | Repeat `/health` in Safari; check address, port, running server, and local network access. |
| `Could not reach the receipt service` | The upload fetch or response-body read failed. Repeat `/health` immediately; watch the backend and Expo logs during one retry. A native upload failure remains possible even when health works. |
| `Receipt request timed out` | The app did not complete the request within its timeout. Check backend availability and the extraction attempt in the server logs. |
| `Receipt processing is temporarily unavailable` | Express returned a structured processing error. Check Gemini credentials/model/access and Supabase storage/schema on the server. |
| Google returns `401` | Verify the running server loaded the intended key; restart it and test Gemini separately. A successful `/health` check does not validate Gemini. |
| Missing/expired bearer token | Sign in again and verify mobile/server use the same Supabase project. |
| Missing table, column, or RPC | Ask the integration owner to verify the branch's required migrations on the configured Supabase project. |

When asking for help, share the API host/port, whether Safari `/health` works, the exact app message, and sanitized backend/Expo output from the same attempt. Never share the key, bearer token, full `.env`, or private receipt data in public logs. “Receipt not ready” is a generic heading; the message below it identifies the error category.

The backend currently logs startup rather than every incoming request. A quiet terminal does not prove the upload never arrived. If request arrival needs diagnosing, ask the integration owner for temporary sanitized method/path/status logging; do not log authorization headers or receipt bodies.
