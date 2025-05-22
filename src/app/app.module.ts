import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { NavbarComponent } from './navbar/navbar.component';
import { TarjetasComponent } from './tarjetas/tarjetas.component';
import { LoginModalComponent } from './login-modal/login-modal.component';
import { RegisterModalComponent } from './register-modal/register-modal.component';
import { AngularFireModule } from '@angular/fire/compat'; // Importa AngularFireModule
import { environment } from '../environments/environment'; // Asegúrate de que la ruta sea correcta

@NgModule({
  declarations: [],
  imports: [
    BrowserModule,
    FormsModule, // Generalmente se incluye, aunque ReactiveFormsModule es el clave aquí
    ReactiveFormsModule, // <-- ¡Asegúrate de que esto esté aquí!
    AppComponent,
    NavbarComponent,
    TarjetasComponent,
    LoginModalComponent,
    RegisterModalComponent,
    AngularFireModule.initializeApp(environment.firebaseConfig), // Inicializa AngularFireModule
  ],
  providers: [],
})
export class AppModule {}
