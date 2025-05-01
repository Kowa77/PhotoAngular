import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { RegisterModalComponent } from '../register-modal/register-modal.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule, LoginModalComponent, RegisterModalComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements AfterViewInit {
  isMenuOpen: boolean = false;
  @ViewChild('loginModal') loginModal!: LoginModalComponent; // Usamos el operador !
  @ViewChild('registerModal') registerModal!: RegisterModalComponent; // Usamos el operador !
  isLoggedIn: boolean = false; // Ejemplo para controlar la visibilidad de los botones
  loggedInUser: any = null; // Ejemplo para almacenar la información del usuario

  constructor(private router: Router) { }

  ngAfterViewInit(): void {
    // Ahora loginModal y registerModal deberían estar definidos y accesibles
    console.log('Login Modal Component:', this.loginModal);
    console.log('Register Modal Component:', this.registerModal);
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
    this.isLoggedIn = true;
    this.loggedInUser = user;
    console.log('Usuario logueado:', user);
    // Actualiza la interfaz del navbar (ocultar botones, mostrar info del usuario)
  }

  handleRegisterSuccess(user: any): void {
    this.isLoggedIn = true;
    this.loggedInUser = user;
    console.log('Usuario registrado:', user);
    // Actualiza la interfaz del navbar
  }

  logout(): void {
    this.isLoggedIn = false;
    this.loggedInUser = null;
    this.router.navigate(['/']);
    console.log('Usuario cerró sesión');
    // Lógica para limpiar tokens, etc.
  }
}
