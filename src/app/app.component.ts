import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { FooterComponent } from './paginas/footer/footer.component';
import { CommonModule } from '@angular/common';
//import { authConfig } from './app.config';

// Note: SweetAlert2 is loaded via CDN in the main HTML file,
// so it is not imported here. It is accessed as a global variable `Swal`.
declare const Swal: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'servicephoto-angular';

  constructor() {

  }


}
