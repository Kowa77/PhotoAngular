declare global {
  interface Window {
    FIREBASE_API_KEY?: string;
    FIREBASE_AUTH_DOMAIN?: string;
    FIREBASE_DATABASE_URL?: string;
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_STORAGE_BUCKET?: string;
    FIREBASE_MESSAGING_SENDER_ID?: string;
    FIREBASE_APP_ID?: string;
    FIREBASE_MEASUREMENT_ID?: string;
    VEXOR_PAY_PUBLIC_KEY?: string;
  }
}

export const environment = {
  production: true,
  apiUrl: '/api',
  firebaseConfig: {
    apiKey: window['FIREBASE_API_KEY'] || "AIzaSyAattwoKL9pde1WDLtVr29KdszuX0It3E8",
    authDomain: window['FIREBASE_AUTH_DOMAIN'] || "bsfotografia-9fc03.firebaseapp.com",
    databaseURL: window['FIREBASE_DATABASE_URL'] || "https://bsfotografia-9fc03-default-rtdb.firebaseio.com",
    projectId: window['FIREBASE_PROJECT_ID'] || "bsfotografia-9fc03",
    storageBucket: window['FIREBASE_STORAGE_BUCKET'] || "bsfotografia-9fc03.firebasestorage.app",
    messagingSenderId: window['FIREBASE_MESSAGING_SENDER_ID'] || "523548400063",
    appId: window['FIREBASE_APP_ID'] || "1:523548400063:web:7517a9aa5874b002d1290a",
    measurementId: window['FIREBASE_MEASUREMENT_ID'] || "G-36GLWZND8D"
  }
};
