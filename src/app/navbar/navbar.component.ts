import { Component, ViewChild, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { RegisterModalComponent } from '../register-modal/register-modal.component';
import { AuthService } from '../auth/auth.service'; // Importa el AuthService
import { User } from '@angular/fire/auth'; // Importa la interfaz User
import { Subscription } from 'rxjs'; // Importa Subscription para manejar el observable

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule, LoginModalComponent, RegisterModalComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements AfterViewInit, OnInit, OnDestroy {
  isMenuOpen: boolean = false;
  @ViewChild('loginModal') loginModal!: LoginModalComponent;
  @ViewChild('registerModal') registerModal!: RegisterModalComponent;
  isLoggedIn: boolean = false;
  loggedInUserEmail: string | null = null; // Cambiado a solo el email para mostrar
  private authSubscription: Subscription | undefined; // Para la suscripción al estado de auth

  constructor(private router: Router, private authService: AuthService) { } // Inyecta el AuthService

  ngOnInit(): void {
    this.authSubscription = this.authService.getAuthState().subscribe(user => {
      if (user) {
        this.isLoggedIn = true;
        this.loggedInUserEmail = user.email;
        console.log('Estado de autenticación en Navbar:', this.isLoggedIn, this.loggedInUserEmail);
        // Aquí podrías cargar más información del usuario si es necesario
      } else {
        this.isLoggedIn = false;
        this.loggedInUserEmail = null;
        console.log('Usuario no autenticado en Navbar');
      }
    });
  }

  ngAfterViewInit(): void {
    // Ahora loginModal y registerModal deberían estar definidos y accesibles
    console.log('Login Modal Component:', this.loginModal);
    console.log('Register Modal Component:', this.registerModal);
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe(); // Desuscribe para evitar fugas de memoria
    }
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  openLoginModal(): void {
    if (this.loginModal) {
      this.loginModal.openModal();
      this.isMenuOpen = false;
    } else {
      console.error('Error: Login Modal Component no está definido.');
    }
  }

  closeLoginModal(): void {
    // Lógica adicional al cerrar el modal de login si es necesario
  }

  openRegisterModal(): void {
    if (this.registerModal) {
      this.registerModal.openModal();
      this.isMenuOpen = false;
    } else {
      console.error('Error: Register Modal Component no está definido.');
    }
  }

  closeRegisterModal(): void {
    // Lógica adicional al cerrar el modal de registro si es necesario
  }

  handleLoginSuccess(user: any): void {
    // El observable getAuthState ya está manejando la actualización del estado
    // Puedes realizar acciones adicionales aquí si es necesario,
    // pero isLoggedIn y loggedInUserEmail ya deberían estar actualizados.
    console.log('Inicio de sesión exitoso en Navbar (evento):', user);
  }

  handleRegisterSuccess(user: any): void {
    // El observable getAuthState ya está manejando la actualización del estado
    // Puedes realizar acciones adicionales aquí si es necesario.
    console.log('Registro exitoso en Navbar (evento):', user);
  }

  logout(): void {
    this.authService.logoutUser();
    // El observable getAuthState se encargará de actualizar isLoggedIn y loggedInUserEmail a null
    console.log('Usuario cerró sesión desde Navbar');
    this.router.navigate(['/']);
    // Lógica adicional para limpiar tokens, etc. si es necesario
  }
}
