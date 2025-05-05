import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { environment } from './environments/environment';
import { importProvidersFrom } from '@angular/core';
import { AngularFireModule } from '@angular/fire/compat';

// Inicializa AngularFireModule ANTES de bootstrapApplication
const angularFireProviders = importProvidersFrom(AngularFireModule.initializeApp(environment.firebase));

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideDatabase(() => getDatabase()),
    angularFireProviders, // Agrega los providers de AngularFireModule
  ],
}).catch((err) => console.error(err));
