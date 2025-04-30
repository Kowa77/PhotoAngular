import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from './environments/environment';
import { provideRouter } from '@angular/router'; // Importa provideRouter
import { routes } from './app/app.routes'; // Importa tus rutas
import 'bootstrap/dist/js/bootstrap.bundle'; // Importa todo el bundle de Bootstrap (incluye Popper.js)
// O puedes importar solo el módulo modal si lo prefieres:
// import 'bootstrap/js/dist/modal';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes), // Proporciona las rutas
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    // Otros providers de Firebase que necesites
  ]
}).catch((err) => console.error(err));
