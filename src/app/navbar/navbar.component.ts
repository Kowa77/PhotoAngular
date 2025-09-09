import { Component, ViewChild, AfterViewInit, OnInit, OnDestroy, ChangeDetectorRef, signal  } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { RegisterModalComponent } from '../register-modal/register-modal.component';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firefirebase-service.service'; // <-- AÑADE ESTA LÍNEA
import { Subscription } from 'rxjs';
import { ExpiredReservationsNotificationComponent } from '../expired-reservations-notification/expired-reservations-notification.component';
import { Reservation } from '../models/reservation.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    CommonModule,
    LoginModalComponent,
    RegisterModalComponent,
    ExpiredReservationsNotificationComponent
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit, OnDestroy {
  isMenuOpen: boolean = false;
  @ViewChild('loginModal') loginModal!: LoginModalComponent;
  @ViewChild('registerModal') registerModal!: RegisterModalComponent;
  isLoggedIn: boolean = false;
  loggedIn: string | null = null;
  userId: string | null = null;
  isAdmin = signal(false);
  menuOpen: boolean = false;
  userPhotoURL: string | null = null;


  hasExpiredReservation: boolean = false; // <-- AÑADE ESTA NUEVA PROPIEDAD
  private authSubscription: Subscription | undefined;
  private reservationsSubscription: Subscription | undefined; // <-- AÑADE ESTA NUEVA SUSCRIPCIÓN
  constructor(private router: Router, private authService: AuthService, private changeDetectorRef: ChangeDetectorRef, private firebaseService: FirebaseService) { }

 ngOnInit(): void {
  this.authSubscription = this.authService.getAuthState().subscribe(user => {
    this.isLoggedIn = !!user;
    this.loggedIn = user?.email || null;
    this.userId = user?.uid || null;
    this.userPhotoURL = user?.photoURL || null;

    this.isAdmin.set(user?.email === 'admin@gmail.com');



    if (this.isLoggedIn && this.userId) {
      this.checkUserReservations(this.userId);
    } else {
      if (this.reservationsSubscription) {
        this.reservationsSubscription.unsubscribe();
      }
      this.hasExpiredReservation = false;
    }

    if (!this.isLoggedIn && this.loginModal && !this.hasOpenedLoginModal) {
      setTimeout(() => {
        this.loginModal.openModal();
        this.changeDetectorRef.detectChanges();
        this.hasOpenedLoginModal = true;
      }, 0);
    }
  });
}


  private checkUserReservations(userId: string): void {
  // Si ya existe una suscripción, la limpiamos primero para evitar duplicados
  if (this.reservationsSubscription) {
    this.reservationsSubscription.unsubscribe();
  }

  // Nos suscribimos al observable de reservas del usuario
  this.reservationsSubscription = this.firebaseService.getUserReservations(userId)
    .subscribe((reservations: Reservation[]) => {
      // Verificamos si alguna de las reservas tiene el estado 'expired'
      this.hasExpiredReservation = reservations.some((res: Reservation) => res.details.status === 'expired');
    });
}


  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.reservationsSubscription) { // <-- LIMPIAMOS LA NUEVA SUSCRIPCIÓN
          this.reservationsSubscription.unsubscribe();
        }
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

// ✅ Toggle para mobile
 toggleMenu() {
  this.isMenuOpen = !this.isMenuOpen;
}

closeMenu() {
  this.isMenuOpen = false;
}

  private hasOpenedLoginModal: boolean = false; // Bandera para controlar la apertura inicial del modal
}
