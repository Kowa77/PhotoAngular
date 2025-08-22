import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { FooterComponent } from './paginas/footer/footer.component'; // Importa el nuevo componente
import { AuthService } from './auth/auth.service'; // Importa el AuthService
import { CommonModule } from '@angular/common'; // Importa CommonModule si lo vas a usar en el template

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent], // AuthModalComponent eliminado
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'servicephoto-angular';
  isLoggedIn: boolean = false; // Variable para rastrear el estado de login

  constructor(private authService: AuthService) {} // Inyecta el AuthService

  ngOnInit(): void {
    this.authService.getAuthState().subscribe(user => {
      this.isLoggedIn = !!user; // Si hay un usuario, está logueado (true), sino null (false)
      //console.log('Estado de autenticación en AppComponent:', this.isLoggedIn, user);
      // Aquí puedes realizar otras acciones basadas en el estado de login,
      // como mostrar/ocultar elementos de la UI.
    });
  }
}
