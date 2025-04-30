import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { NavbarComponent } from './navbar/navbar.component';
import { TarjetasComponent } from './tarjetas/tarjetas.component';
import { AuthModalComponent } from './auth-modal/auth-modal.component';

@NgModule({
  imports: [
    BrowserModule,
    NavbarComponent,
    TarjetasComponent,
    AuthModalComponent
  ],
  providers: [],
})
export class AppModule { }
