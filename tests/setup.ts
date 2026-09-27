import { config } from "dotenv";

// A handful of tests hit real Tiger Data / a real model call (classifier
// caching, doctor-style checks) and need the same env vars scripts load
// via `config({ path: ".env.local" })`. Vitest doesn't load .env.local on
// its own.
config({ path: ".env.local" });
