// app.config.js — plain JS so EAS build workers can parse it without sucrase issues.
// (app.config.ts with TypeScript type annotations causes "Unexpected token ':'" on EAS)

export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    // Firebase config — all have safe public defaults, override via EAS env vars for prod
    firebaseApiKey:            process.env.FIREBASE_API_KEY             ?? 'AIzaSyBiT18T3LF9iopQsMdmeBN0BmGrHCCrxOU',
    firebaseAuthDomain:        process.env.FIREBASE_AUTH_DOMAIN         ?? 'basketbuddy-e6676.firebaseapp.com',
    firebaseProjectId:         process.env.FIREBASE_PROJECT_ID          ?? 'basketbuddy-e6676',
    firebaseStorageBucket:     process.env.FIREBASE_STORAGE_BUCKET      ?? 'basketbuddy-e6676.firebasestorage.app',
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? '134089448283',
    firebaseAppId:             process.env.FIREBASE_APP_ID              ?? '1:134089448283:web:606976ef00f6ac003e187e',
    // Cloud Functions base URL
    functionsBaseUrl: process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL ?? 'https://us-central1-basketbuddy-e6676.cloudfunctions.net',
    // Groq key for on-device receipt scanning
    groqApiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '',
  },
});
