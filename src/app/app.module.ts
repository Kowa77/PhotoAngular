import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component'; // Import AppComponent
import { NavbarComponent } from './navbar/navbar.component';
import { TarjetasComponent } from './tarjetas/tarjetas.component';
//import { AuthModalComponent } from './auth-modal/auth-modal.component';
import { LoginModalComponent } from './login-modal/login-modal.component';
import { RegisterModalComponent } from './register-modal/register-modal.component';

@NgModule({
  declarations: [
    // AuthModalComponent (if it's NOT standalone)
  ],
  imports: [
    BrowserModule,
    AppComponent, // Import AppComponent here
    NavbarComponent,
    TarjetasComponent,
    LoginModalComponent,
    RegisterModalComponent,
    // AuthModalComponent (if it IS standalone, import it here)
  ],
  providers: [] // Add any services you want to provide globally

})
export class AppModule { }
