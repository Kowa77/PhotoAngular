import { Component, Input, OnInit, OnDestroy, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Reservation } from '../models/reservation.model';
import { Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-expired-reservations-notification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './expired-reservations-notification.component.html',
  styleUrl: './expired-reservations-notification.component.css'
})
export class ExpiredReservationsNotificationComponent implements OnInit, OnDestroy, OnChanges {
  @Input() userId: string | null = null;
  @Input() hasExpiredReservation: boolean = false;

  isDropdownOpen = false;
  expiredReservations: Reservation[] = [];

  private firebaseService: FirebaseService = inject(FirebaseService);
  private reservationsSubscription?: Subscription;

  ngOnInit(): void {
    // Si ya vino userId al instanciarse
    if (this.userId) {
      this.subscribeToReservations();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Si userId cambia dinámicamente después del init
    if (changes['userId'] && this.userId) {
      this.subscribeToReservations();
    }
  }

  private subscribeToReservations(): void {
    if (this.reservationsSubscription) {
      this.reservationsSubscription.unsubscribe();
    }

    this.reservationsSubscription = this.firebaseService
      .getUserReservations(this.userId!)
      .subscribe((reservations: Reservation[]) => {
        this.expiredReservations = reservations.filter(
          (res: Reservation) => res.details.status === 'expired'
        );
      });
  }

  ngOnDestroy(): void {
    this.reservationsSubscription?.unsubscribe();
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  hideDropdown(): void {
    this.isDropdownOpen = false;
  }
}
