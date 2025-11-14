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
