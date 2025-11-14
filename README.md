# FoodChat (vibe-coded)

FoodChat is a deliberately vibe-coded React/Vite experience that lets you track meals with a chat-like interface. The assistant accepts a description or image of your food, sends it to OpenAI using the locally stored API key, and replies with a structured JSON response that becomes a chat bubble. Each day's conversation and calorie total are stored in localStorage so you can browse history even when offline.

## Features

- OpenAI-powered assistant that handles both text and image inputs and replies with `{ type, message, calories }`.
- Sticky header showing today's total calories plus a drawer to browse previous days.
- Chat history persisted per day; only the message stream scrolls for a native-app feel.
- Local API key storage inside the browser—nothing leaves the device except the actual OpenAI request.
- Inline preview for meal photos before they're sent.
- Light/dark theme toggle and DE/EN language switch so the UI fits any mood.

## Running the project

```bash
npm install
npm run dev
```

Use the UI to provide your OpenAI API key (stored locally), then chat about your meals. Remember: this project is vibe coded **only**—no rigid spec, just the feels. Customize, remix, or extend as you like.

## Concept: securing the API key in localStorage

The app currently stores the API key locally so FoodChat can work offline, but browsers do not offer true secure storage by default. A pragmatic hardening plan:

1. **Passphrase gate** – Ask the user for a passphrase on first launch. Derive an AES key with PBKDF2 (`SubtleCrypto.importKey` + `deriveKey`) using a random salt stored alongside the ciphertext.
2. **Encrypt before persisting** – Encrypt the API key with AES-GCM using that derived key. Save only `{ salt, iv, ciphertext }` in localStorage; the derived CryptoKey lives only in memory.
3. **Unlock per session** – On reload, request the passphrase, derive the key again, and decrypt. Keep the plaintext API key in memory only, wiping it (and revoking references) whenever the tab is closed or after a timeout.
4. **Optional biometrics** – Where WebAuthn/passkeys are available, let the user replace the passphrase with a platform authenticator so the encryption key is unwrapped only after a biometric assertion.
5. **Future hooks** – Expose a `provideApiKey` hook so native wrappers or password managers can inject the API key from a more secure channel instead of localStorage.

This design keeps the encryption secret under the user's control and avoids leaving the plaintext API key on disk, while staying 100% client-side to preserve the offline vibe.
