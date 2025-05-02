import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';
import { User } from '@angular/fire/auth';
import { CommonModule } from '@angular/common'; // Importa CommonModule para *ngIf
import { Router } from '@angular/router'; // Importa el Router

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  user$: Observable<User | null>;

  constructor(private authService: AuthService, private router: Router, private cdr: ChangeDetectorRef) { // Inyecta el Router
    this.user$ = this.authService.getAuthState();
  }

  ngOnInit(): void {
    this.user$.subscribe(user => {
      console.log('Estado de autenticación:', user);
      // Aquí podrías realizar acciones basadas en el estado del usuario
    });
  }

  async logout() {
    try {
      await this.authService.logoutUser();
      console.log('Cierre de sesión exitoso');
      this.router.navigate(['/']); // Ejemplo de redirección
      this.cdr.detectChanges(); // Forzar detección de cambios
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }
}
