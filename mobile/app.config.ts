import { ExpoConfig, ConfigContext } from 'expo/config';
import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  extra: {
    ...config.extra,
    // Firebase config — override via .env or EAS secrets for different environments
    // These values are safe to be public (protected by Firestore rules + HTTP referrer)
    // but env vars let you swap dev/staging/prod configs without code changes.
    firebaseApiKey:            process.env.FIREBASE_API_KEY            ?? 'AIzaSyBiT18T3LF9iopQsMdmeBN0BmGrHCCrxOU',
    firebaseAuthDomain:        process.env.FIREBASE_AUTH_DOMAIN        ?? 'basketbuddy-e6676.firebaseapp.com',
    firebaseProjectId:         process.env.FIREBASE_PROJECT_ID         ?? 'basketbuddy-e6676',
    firebaseStorageBucket:     process.env.FIREBASE_STORAGE_BUCKET     ?? 'basketbuddy-e6676.firebasestorage.app',
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? '134089448283',
    firebaseAppId:             process.env.FIREBASE_APP_ID             ?? '1:134089448283:web:606976ef00f6ac003e187e',
  },
});
