import { applicationDefault, type AppOptions, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Read-only Firebase access for the migration. Credentials: the CI secret
 * (GOOGLE_APPLICATION_CREDENTIALS, see .github/workflows/admin.yml) or the
 * FIREBASE_ADMIN_* variables from apps/web/.env.local. Rehearsals run against
 * the local emulators (FIRESTORE_EMULATOR_HOST etc.), which need no credential.
 */
function options(): AppOptions {
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ?? "group-trips-2f753.firebasestorage.app";
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return { projectId: process.env.GCLOUD_PROJECT ?? "demo-trips", storageBucket };
  }
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const credential =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL && privateKey
      ? cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey,
        })
      : applicationDefault();
  return { credential, storageBucket };
}

export function firebase() {
  if (!getApps().length) initializeApp(options());
  return { auth: getAuth(), db: getFirestore(), bucket: getStorage().bucket() };
}
