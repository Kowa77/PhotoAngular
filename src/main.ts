// src/main.ts

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideDatabase, getDatabase } from '@angular/fire/database'; // Para Realtime Database
import { environment } from './environments/environment';
import { provideHttpClient } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    // ¡Esto es lo correcto para tu environment.ts!
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)), // Asegúrate de que tu environment.ts define 'firebaseConfig'
    provideAuth(() => getAuth()),
    provideDatabase(() => getDatabase()), // Esto es para Realtime Database
    provideHttpClient(),
  ],
}).catch((err) => console.error(err));
