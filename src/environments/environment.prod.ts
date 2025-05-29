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
    // Agrega aquí cualquier otra variable de entorno que uses
  }
}

export const environment = {
  production: true,
  firebaseConfig: { // Mantenemos firebaseConfig
    apiKey: window['FIREBASE_API_KEY'] || "AIzaSyCmuYZFEd_5byi9usEVelfCNX7oAzdhJ7M",
    authDomain: window['FIREBASE_AUTH_DOMAIN'] || "serviciosfotosyvideos.firebaseapp.com",
    databaseURL: window['FIREBASE_DATABASE_URL'] || "https://serviciosfotosyvideos-default-rtdb.firebaseio.com",
    projectId: window['FIREBASE_PROJECT_ID'] || "serviciosfotosyvideos",
    storageBucket: window['FIREBASE_STORAGE_BUCKET'] || "serviciosfotosyvideos.firebasestorage.app",
    messagingSenderId: window['FIREBASE_MESSAGING_SENDER_ID'] || "966333943753",
    appId: window['FIREBASE_APP_ID'] || "1:966333943753:web:2549cd36af0df615b06218",
    measurementId: window['FIREBASE_MEASUREMENT_ID'] || "G-VS2Y7558Y5"
  },

};
