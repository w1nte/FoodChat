# FoodChat (vibe-coded)

FoodChat is a deliberately vibe-coded React/Vite experience that lets you track meals through a cozy chat interface. Describe or snap your food, send it to the on-device assistant, and get a structured JSON reply that updates the daily calorie tally. Each day’s conversation is cached locally so you can browse it even while offline.

## Features

- OpenAI-powered assistant that ingests text or images and replies with `{ type, message, calories }`.
- Sticky header with today’s calories and a history drawer per day.
- Daily histories live in localStorage; only the chat column scrolls for a native-app feel.
- Inline image preview before sending and quick actions to disable calorie entries retroactively.
- Red “yummy” theme + dark/light toggle and instant DE/EN language switching.
- API key encryption with optional passphrase memory so credentials never leave the device.

## Running the project

```bash
npm install
npm run dev
```

Use the UI to provide your OpenAI API key (stored locally and encrypted), then chat about what you ate. This project is vibe coded **only**—remix it however you like.

## Concept: securing the API key in localStorage

1. **Passphrase gate** – Ask for a passphrase on first launch (optionally remember it in localStorage). Derive an AES key with PBKDF2 (`SubtleCrypto.importKey` + `deriveKey`) using a random salt.
2. **Encrypt before persisting** – Encrypt the API key with AES-GCM using that derived key. Save only `{ salt, iv, ciphertext }` in localStorage; the CryptoKey stays in memory.
3. **Unlock per session** – Without a remembered passphrase, prompt again on reload. Keep the decrypted key in memory only and wipe it when the tab closes or times out.
4. **Optional biometrics** – WebAuthn/passkeys can replace the passphrase in the future for biometric unlocks.
5. **Hooks for other storage** – Expose a hook so native shells or password managers can inject keys from more secure hardware-backed sources.
