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
    //MERCADOPAGO_PUBLIC_KEY?: string;

    // Agrega aquí cualquier otra variable de entorno que uses
  }
}

export const environment = {
  production: true,
  firebaseConfig: { // Mantenemos firebaseConfig
    apiKey: window['FIREBASE_API_KEY'] || "AIzaSyAzcdECH5fK13xqZ_vwjKT1b7kg7TFbuVk",
    authDomain: window['FIREBASE_AUTH_DOMAIN'] || "prueba-b4e16.firebaseapp.com",
    databaseURL: window['FIREBASE_DATABASE_URL'] || "https://prueba-b4e16-default-rtdb.firebaseio.com",
    projectId: window['FIREBASE_PROJECT_ID'] || "prueba-b4e16",
    storageBucket: window['FIREBASE_STORAGE_BUCKET'] || "prueba-b4e16.firebasestorage.app",
    messagingSenderId: window['FIREBASE_MESSAGING_SENDER_ID'] || "570563896774",
    appId: window['FIREBASE_APP_ID'] || "1:570563896774:web:8273007c65b27e22697ec7",
    measurementId: window['FIREBASE_MEASUREMENT_ID'] || "G-Z895770MGT"
  },
  // mercadopago: {
  //   publicKey: window['MERCADOPAGO_PUBLIC_KEY'] || "TEST-3f0b1c2d-4a5e-4f8b-9a7c-6d3e0f8b2c1d"
  // }

};
