// app.config.js — plain JS so EAS build workers can parse it without sucrase issues.
// (app.config.ts with TypeScript type annotations causes "Unexpected token ':'" on EAS)
//
// Secrets are NEVER hardcoded here. Supply them via:
//   Local dev  → mobile/.env.local  (gitignored)
//   EAS builds → `eas secret:create` (stored on Expo's servers, injected at build time)

export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    // Firebase config
    firebaseApiKey:            process.env.FIREBASE_API_KEY,
    firebaseAuthDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    firebaseProjectId:         process.env.FIREBASE_PROJECT_ID,
    firebaseStorageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId:             process.env.FIREBASE_APP_ID,
    // Cloud Functions base URL
    functionsBaseUrl: process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL,
    // Groq key for on-device receipt scanning
    groqApiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY,
  },
});
