// src/app/agenda/agenda.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { AuthService } from '../auth/auth.service';
import { Subscription, combineLatest, Observable, BehaviorSubject, Subject } from 'rxjs'; // Importar Subject
import { map, switchMap, filter, tap, takeUntil, distinctUntilChanged } from 'rxjs/operators'; // Importar takeUntil, distinctUntilChanged

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
  private destroy$: Subject<void> = new Subject<void>(); // Usaremos este para desuscribir observables específicos
  currentUserUid: string | null = null;

  // Creamos un BehaviorSubject para gestionar la fecha seleccionada
  private _selectedDateSource: BehaviorSubject<Date | null> = new BehaviorSubject<Date | null>(new Date());
  selectedDate: Date | null = null; // Mantendremos esta propiedad para el ngModel en la plantilla

  reservationsForSelectedDate: Reservation[] = [];
  allReservationsMap: ReservationsByDateMap = {};

  startAt: Date;
  minDate: Date;
  maxDate: Date;

  myReservaciones: Reservation[] = []; // Renombrado a myReservaciones para evitar conflictos de nombre

  constructor() {
    const today = new Date();
    this.minDate = new Date(today.getFullYear(), 0, 1);
    this.startAt = today;
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 2);
  }

  dateClass = (date: Date) => {
    const formattedDate = this.formatDate(date);
    if (this.allReservationsMap[formattedDate] && Object.keys(this.allReservationsMap[formattedDate]).length > 0) {
      return 'has-bookings';
    }
    return '';
  };

  ngOnInit(): void {
    // 1. Suscripción para obtener el UID del usuario
    this.authService.user$.pipe(
      map(user => user ? user.uid : null),
      tap(uid => this.currentUserUid = uid),
      distinctUntilChanged(), // Solo emite si el UID cambia
      takeUntil(this.destroy$) // Desuscribe cuando el componente se destruye
    ).subscribe(uid => {
      // Si el UID cambia o se carga por primera vez, recargar el mapa de reservas y mis reservas
      if (uid) {
        // Cargar todas las reservas (para el calendario)
        this.firebaseService.allReservations$().pipe(
          takeUntil(this.destroy$)
        ).subscribe(reservations => {
          this.allReservationsMap = reservations;
          console.log("AgendaComponent: Mapa de todas las reservas (para calendario) actualizado:", this.allReservationsMap);
        });

        // Cargar las reservas del usuario y configurar la fecha inicial
        this.firebaseService.allReservations$().pipe(
          map(allReservations => {
            const userReservations: Reservation[] = [];
            for (const date in allReservations) {
              for (const resId in allReservations[date]) {
                if (allReservations[date][resId].details.userId === uid) {
                  userReservations.push(allReservations[date][resId]);
                }
              }
            }
            return userReservations.sort((a, b) => new Date(a.details.date).getTime() - new Date(b.details.date).getTime());
          }),
          tap(userReservations => {
            this.myReservaciones = userReservations; // Usamos myReservaciones
            console.log("AgendaComponent: Mis reservas actualizadas:", this.myReservaciones);
            // Si no hay fecha seleccionada y hay reservas, intenta establecer la primera futura.
            // Si no hay futuras o no hay reservas, establece la fecha de hoy.
            if (!this.selectedDate && this.myReservaciones.length > 0) {
                const firstFutureReservation = this.myReservaciones.find(res => this.isReservationUpcoming(res, new Date()));
                const dateToSet = firstFutureReservation ? new Date(firstFutureReservation.details.date) : new Date();
                this._selectedDateSource.next(dateToSet);
            } else if (!this.selectedDate && this.myReservaciones.length === 0) {
                // Si no hay reservas ni fecha seleccionada, por defecto hoy.
                this._selectedDateSource.next(new Date());
            } else if (this.selectedDate) {
                // Si ya hay una fecha seleccionada (ej. por navegación previa), aseguramos que se refleje.
                this._selectedDateSource.next(this.selectedDate);
            }
          }),
          takeUntil(this.destroy$) // Desuscribe cuando el componente se destruye
        ).subscribe(); // No necesitamos un manejo explícito del valor aquí, el tap lo hace

      } else {
        // Usuario deslogueado: limpiar datos
        this.myReservaciones = [];
        this.reservationsForSelectedDate = [];
        this.allReservationsMap = {};
        this._selectedDateSource.next(null); // O un new Date() si quieres que el calendario muestre siempre hoy
        console.log("AgendaComponent: Usuario deslogueado, limpiando datos.");
      }
    });

    // 2. Suscripción unificada para cargar reservas para la fecha seleccionada
    // Esta suscripción escuchará los cambios de _selectedDateSource
    this._selectedDateSource.pipe(
        filter(date => !!date), // Solo procede si hay una fecha seleccionada
        map(date => this.formatDate(date as Date)), // Formatea la fecha
        distinctUntilChanged(), // Evita recargar si la fecha formateada es la misma
        switchMap(formattedDate => this.firebaseService.getReservationsForDate(formattedDate).pipe(
            map(reservationsMap => Object.values(reservationsMap || {})), // Convierte el mapa a un array
            map(reservations => reservations.filter(res => res.details.userId === this.currentUserUid)), // Filtra por el usuario actual
            tap(reservations => {
                console.log(`AgendaComponent: Mis reservas para ${formattedDate}:`, reservations);
            }),
            takeUntil(this.destroy$) // Asegura que las llamadas internas también se desuscriban
        )),
        takeUntil(this.destroy$) // Asegura que esta suscripción principal se desuscriba
    ).subscribe(reservations => {
        this.reservationsForSelectedDate = reservations;
    }, error => {
        console.error("AgendaComponent: Error al cargar reservas para la fecha seleccionada:", error);
        this.reservationsForSelectedDate = [];
    });

    // Sincronizar selectedDate para el ngModel con el BehaviorSubject
    this._selectedDateSource.pipe(
        takeUntil(this.destroy$)
    ).subscribe(date => {
        this.selectedDate = date;
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.destroy$.next(); // Emite un valor para que takeUntil desuscriba todos los observables
    this.destroy$.complete(); // Completa el Subject
  }

  // Ahora, onDateSelect solo necesita actualizar el BehaviorSubject
  onDateSelect(event: any): void {
    const selectedDate = event.value;
    this._selectedDateSource.next(selectedDate);
  }

  // ... (otros métodos sin cambios, formatDate, cancelReservation, isReservationUpcoming, isReservationHighlighted)
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

  isReservationUpcoming(reservation: Reservation, compareDate: Date | null = null): boolean {
    const reservationDate = new Date(reservation.details.date);
    reservationDate.setHours(0, 0, 0, 0); // Normalizar a inicio del día

    const actualCompareDate = compareDate ? new Date(compareDate) : (this.selectedDate ? new Date(this.selectedDate) : new Date());
    actualCompareDate.setHours(0,0,0,0); // Normalizar a inicio del día

    return reservationDate >= actualCompareDate;
  }

  isReservationHighlighted(reservationDateString: string): boolean {
    if (!this.selectedDate) {
      return false;
    }
    const selectedFormattedDate = this.formatDate(this.selectedDate);
    return reservationDateString === selectedFormattedDate;
  }
}
