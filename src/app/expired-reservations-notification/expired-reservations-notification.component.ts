import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { AuthService } from '../auth/auth.service';
import { Reservation } from '../models/reservation.model';
import { Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';


@Component({
  selector: 'app-expired-reservations-notification',
  standalone: true,
  imports: [CommonModule,RouterLink],
  templateUrl: './expired-reservations-notification.component.html',
  styleUrl: './expired-reservations-notification.component.css'
})
export class ExpiredReservationsNotificationComponent implements OnInit, OnDestroy {
  // Recibimos este valor desde el NavbarComponent
  @Input() userId: string | null = null;
  @Input() hasExpiredReservation: boolean = false;

  isDropdownOpen: boolean = false;
  expiredReservations: Reservation[] = [];

  private authService: AuthService = inject(AuthService);
  private firebaseService: FirebaseService = inject(FirebaseService);
  private reservationsSubscription: Subscription | undefined;


  // Suscribimos al observable para obtener las reservas del usuario
ngOnInit(): void {
  if (this.userId) {
    // Suscribimos al observable para obtener las reservas del usuario
    this.reservationsSubscription = this.firebaseService
      .getUserReservations(this.userId)
      .subscribe((reservations: Reservation[]) => {
        // filtramos las vencidas (status: 'expired')
        this.expiredReservations = reservations.filter(
          (res: Reservation) => res.details.status === 'expired'
        );
      });
  }
}

  // --- Lógica temporal para la prueba --- permite a las reservas caducadas mostrarse en el componente
  //  ngOnInit(): void {
  //     this.reservationsSubscription = this.firebaseService.getUserReservations(this.userId).subscribe(reservations => {
  //       this.expiredReservations = reservations.filter(res => {
  //         Si la fecha de la reserva (timestamp) es anterior a la fecha actual, la consideramos vencida.
  //         const reservationDate = new Date(res.details.timestamp);
  //         const currentDate = new Date();
  //         Devolvemos true si la reserva está oficialmente 'expired' O si su fecha es en el pasado
  //         return res.details.status === 'expired' || reservationDate < currentDate;
  //       });
  //     });
  //   }
  // ------------------------------------
  ngOnDestroy(): void {
    if (this.reservationsSubscription) {
      this.reservationsSubscription.unsubscribe();
    }
  }

  // Método para mostrar/ocultar el menú desplegable
  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  // Método para esconder el menú desplegable
  hideDropdown(): void {
    this.isDropdownOpen = false;
  }
}
