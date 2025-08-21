import { Component, ViewChild, AfterViewInit, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { RegisterModalComponent } from '../register-modal/register-modal.component';
import { AuthService } from '../auth/auth.service';
//import { User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule, LoginModalComponent, RegisterModalComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit, OnDestroy {
  isMenuOpen: boolean = false;
  @ViewChild('loginModal') loginModal!: LoginModalComponent;
  @ViewChild('registerModal') registerModal!: RegisterModalComponent;
  isLoggedIn: boolean = false;
  loggedIn: string | null = null;
  private authSubscription: Subscription | undefined;

  constructor(private router: Router, private authService: AuthService, private changeDetectorRef: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.authSubscription = this.authService.getAuthState().subscribe(user => {
      this.isLoggedIn = !!user;
      this.loggedIn = user?.email || null;

      // Abre el modal de login solo en la inicialización si no hay usuario
      if (!this.isLoggedIn && this.loginModal && !this.hasOpenedLoginModal) {
        setTimeout(() => {
          this.loginModal.openModal();
          this.changeDetectorRef.detectChanges();
          this.hasOpenedLoginModal = true; // Evita que se abra de nuevo innecesariamente
        }, 0);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
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

  logout(): void {
    this.authService.logoutUser().then(() => {
      this.router.navigate(['/']); // Redirige a la página de inicio ('/') después de cerrar sesión
    }).catch(error => {
      console.error('Error al cerrar sesión:', error);
      // Opcional: Puedes mostrar un mensaje de error al usuario aquí
    });
  }

  private hasOpenedLoginModal: boolean = false; // Bandera para controlar la apertura inicial del modal
}
