// src/app/agenda/agenda.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { AuthService } from '../auth/auth.service';
import { Subscription, combineLatest, Observable, BehaviorSubject } from 'rxjs';
import { map, switchMap, filter, tap } from 'rxjs/operators';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

import { Reservation, ReservationItem, ReservationDetails, ReservationsByDateMap } from '../models/reservation.model';

@Component({
  selector: 'app-agenda',
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ]
})
export class AgendaComponent implements OnInit, OnDestroy {
  private firebaseService: FirebaseService = inject(FirebaseService);
  private authService: AuthService = inject(AuthService);

  private subscriptions: Subscription = new Subscription();
  currentUserUid: string | null = null;

  selectedDate: Date | null = null;
  reservationsForSelectedDate: Reservation[] = [];
  allReservationsMap: ReservationsByDateMap = {};

  startAt: Date;
  minDate: Date;
  maxDate: Date;

  myReservations: Reservation[] = [];

  constructor() {
    const today = new Date();
    this.minDate = new Date(today.getFullYear(), 0, 1);
    this.startAt = today;
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 2);
  }

  dateClass = (date: Date) => {
    const formattedDate = this.formatDate(date); // formatDate ahora es public
    if (this.allReservationsMap[formattedDate] && Object.keys(this.allReservationsMap[formattedDate]).length > 0) {
      return 'has-bookings';
    }
    return '';
  };

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.user$.pipe(
        map(user => user ? user.uid : null),
        tap(uid => this.currentUserUid = uid),
        filter(uid => !!uid),
        switchMap(uid => this.firebaseService.allReservations$().pipe(
          map(allReservations => {
            const userReservations: Reservation[] = [];
            for (const date in allReservations) {
              for (const resId in allReservations[date]) {
                if (allReservations[date][resId].details.userId === uid) {
                  userReservations.push(allReservations[date][resId]);
                }
              }
            }
            return userReservations;
          })
        ))
      ).subscribe(userReservations => {
        this.myReservations = userReservations.sort((a, b) => new Date(a.details.date).getTime() - new Date(b.details.date).getTime());
        console.log("AgendaComponent: Mis reservas actualizadas:", this.myReservations);

        if (!this.selectedDate && this.myReservations.length > 0) {
            const firstFutureReservation = this.myReservations.find(res => this.isReservationUpcoming(res, new Date()));
            if(firstFutureReservation) {
                this.selectedDate = new Date(firstFutureReservation.details.date);
                this.onDateSelect({ value: this.selectedDate });
            } else {
                this.selectedDate = new Date();
                this.onDateSelect({ value: this.selectedDate });
            }
        } else if (this.selectedDate) {
            this.onDateSelect({ value: this.selectedDate });
        }
      })
    );

    this.subscriptions.add(
      this.firebaseService.allReservations$().subscribe(reservations => {
        this.allReservationsMap = reservations;
        console.log("AgendaComponent: Mapa de todas las reservas (para calendario) actualizado:", this.allReservationsMap);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onDateSelect(event: any): void {
    const selectedDate = event.value;
    this.selectedDate = selectedDate;

    if (selectedDate) {
      const formattedDate = this.formatDate(selectedDate);
      console.log("AgendaComponent: Fecha seleccionada:", formattedDate);

      this.subscriptions.add(
        this.firebaseService.getReservationsForDate(formattedDate).subscribe(reservationsMap => {
          this.reservationsForSelectedDate = Object.values(reservationsMap || {})
                                               .filter(res => res.details.userId === this.currentUserUid);
          console.log(`AgendaComponent: Mis reservas para ${formattedDate}:`, this.reservationsForSelectedDate);
        }, error => {
          console.error(`AgendaComponent: Error al obtener reservas para ${formattedDate}:`, error);
          this.reservationsForSelectedDate = [];
        })
      );
    } else {
      this.reservationsForSelectedDate = [];
    }
  }

  // CAMBIO AQUÍ: make formatDate public
  public formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async cancelReservation(reservation: Reservation): Promise<void> {
    if (!confirm('¿Estás seguro de que quieres cancelar esta reserva?')) {
      return;
    }

    if (this.currentUserUid && reservation.details.userId === this.currentUserUid) {
      try {
        await this.firebaseService.cancelReservation(reservation.details.date, reservation.id);
        alert('Reserva cancelada exitosamente.');
      } catch (error) {
        console.error('Error al cancelar reserva:', error);
        alert('Error al cancelar la reserva. Intenta de nuevo.');
      }
    } else {
      alert('No tienes permiso para cancelar esta reserva.');
    }
  }

  // NUEVO MÉTODO PARA LA PLANTILLA (igual que antes)
  isReservationUpcoming(reservation: Reservation, compareDate: Date | null = null): boolean {
    const reservationDate = new Date(reservation.details.date);
    const actualCompareDate = compareDate ? new Date(compareDate.setHours(0,0,0,0)) : (this.selectedDate ? new Date(this.selectedDate.setHours(0,0,0,0)) : new Date(new Date().setHours(0,0,0,0)));
    return reservationDate >= actualCompareDate;
  }

  // NUEVO MÉTODO PARA DETERMINAR SI UNA TARJETA DE RESERVA DEBE ESTAR RESALTADA
  isReservationHighlighted(reservationDateString: string): boolean {
    if (!this.selectedDate) {
      return false;
    }
    const selectedFormattedDate = this.formatDate(this.selectedDate);
    return reservationDateString === selectedFormattedDate;
  }
}
