import { Component, OnInit, OnDestroy, inject, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { AuthService } from '../auth/auth.service';
import { Subscription, BehaviorSubject, Subject, of, combineLatest } from 'rxjs';
import { map, switchMap, filter, tap, takeUntil, distinctUntilChanged, catchError } from 'rxjs/operators';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

// Importar los tipos necesarios
import { Reservation, DailyAvailabilityMap } from '../models/reservation.model';

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
  ],
  encapsulation: ViewEncapsulation.None
})
export class AgendaComponent implements OnInit, OnDestroy {
  private firebaseService: FirebaseService = inject(FirebaseService);
  private authService: AuthService = inject(AuthService);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

  //private subscriptions: Subscription = new Subscription();
  private destroy$: Subject<void> = new Subject<void>();
  currentUserUid: string | null = null;
  currentUserEmail: string | null = null; // AÑADIDO: Propiedad para el email del usuario

  // BehaviorSubject para gestionar la fecha seleccionada por el usuario en el calendario
  private _selectedDateSource: BehaviorSubject<Date | null> = new BehaviorSubject<Date | null>(new Date());
  public hasUnreadExpiredReservations$ = new BehaviorSubject<boolean>(false);
  selectedDate: Date | null = null;

  // Array de reservas del usuario actual para la fecha seleccionada
  reservationsForSelectedDate: Reservation[] = [];

  // Mapa de disponibilidad diaria para colorear y filtrar el calendario.
  allAvailabilityMap: DailyAvailabilityMap = {};

  startAt: Date;
  minDate: Date;
  maxDate: Date;

  myReservaciones: Reservation[] = [];

  constructor() {
    const today = new Date();
    this.minDate = new Date(today.getFullYear(), 0, 1);
    this.startAt = today;
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 2);
  }

  // Nueva función para filtrar fechas no disponibles en el calendario.
  // Retorna 'true' si el día está habilitado y 'false' si está deshabilitado.
  dateFilter = (date: Date | null): boolean => {
    // Si la fecha es nula, deshabilitar.
    if (!date) {
      return false;
    }

    const formattedDate = this.formatDate(date);
    const availabilityEntry = this.allAvailabilityMap[formattedDate];

    // Si no hay entrada de disponibilidad o si el día está marcado como 'disponible' (true),
    // la fecha está habilitada para la selección.
    if (!availabilityEntry || availabilityEntry.available) {
      return true;
    }

    // Si el día está marcado como no disponible (available: false),
    // la fecha debe estar deshabilitada.
    return false;
  };

  dateClass = (date: Date): string => {
    // Formatea la fecha para que coincida con la clave en el mapa (ej: '2025-08-27').
    const formattedDate = this.formatDate(date);

    // ACCESO CLAVE: Accedemos a la entrada de disponibilidad para la fecha específica
    const availabilityEntry = this.allAvailabilityMap[formattedDate];

    // Verificamos si existe una entrada de disponibilidad para esa fecha
    if (availabilityEntry) {
      // Si existe, verificamos si el día está reservado (available es false)
      // Y si el ID del usuario que lo reservó (bookedBy) coincide
      // con el ID del usuario actual (this.currentUserUid).
      if (availabilityEntry.available === false && availabilityEntry.bookedBy === this.currentUserUid) {
        // Si ambas condiciones son verdaderas, aplica la clase para TUS reservas
        return 'has-bookings';
      }
    }
    // Si no hay reserva o no es tuya, no aplica ninguna clase
    return '';
  };

  ngOnInit(): void {
    // --- BLOQUE 1: Cargar allAvailabilityMap para el calendario ---
    this.firebaseService.allReservations$().pipe(
      takeUntil(this.destroy$)
    ).subscribe(dailyAvailabilityMap => {
      this.allAvailabilityMap = dailyAvailabilityMap;
      this.cdr.detectChanges();
    });

    // --- BLOQUE 2: Gestionar el UID del usuario actual ---
    // Este bloque se mantiene, pero la lógica de reservas se mueve al bloque de abajo.
    this.authService.user$.pipe(
      map(user => user ? { uid: user.uid, email: user.email } : { uid: null, email: null }),
      distinctUntilChanged((prev, curr) => prev.uid === curr.uid),
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.currentUserUid = user.uid;
      this.currentUserEmail = user.email;
      if (!user.uid) {
        this.myReservaciones = [];
        this.reservationsForSelectedDate = [];
      }
      this._selectedDateSource.next(this.selectedDate);
      this.cdr.detectChanges();
    });

    // --- BLOQUE 3: Cargar reservas específicas para el usuario y la fecha seleccionada ---
    // Este bloque se mantiene sin cambios, ya que funciona correctamente.
    combineLatest([
      this._selectedDateSource.pipe(filter(date => !!date)),
      this.authService.user$.pipe(
        map(user => user ? user.uid : null),
        distinctUntilChanged()
      )
    ]).pipe(
      map(([date, uid]) => ({ formattedDate: this.formatDate(date as Date), uid })),
      distinctUntilChanged((prev, curr) => prev.formattedDate === curr.formattedDate && prev.uid === curr.uid),
      switchMap(({ formattedDate, uid }) => {
        if (!uid) {
          return of([]);
        }
        return this.firebaseService.getReservationsForDate(formattedDate).pipe(
          map(reservationsMap => Object.values(reservationsMap || {})),
          map(reservations => reservations.filter(res => res.details.userId === uid)),
          catchError(() => of([])),
          takeUntil(this.destroy$)
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((reservations: Reservation[]) => {
      this.reservationsForSelectedDate = reservations;
    }, () => {
      this.reservationsForSelectedDate = [];
    });

    // --- NUEVO BLOQUE: Revisar reservas vencidas no leídas para la notificación ---
    // Este bloque se suscribe al usuario actual y luego obtiene sus reservas.
    this.authService.user$.pipe(
      map(user => user?.uid),
      distinctUntilChanged(), // Para evitar ejecuciones duplicadas
      switchMap(uid => {
        if (!uid) {
          // Si no hay usuario logueado, emitir un array vacío de reservas
          return of([]);
        }
        // Llamar al método que ya tienes y que obtiene las reservas del usuario
        return this.firebaseService.getUserReservations(uid);
      }),
      takeUntil(this.destroy$)
    ).subscribe(userReservations => {
      let foundUnreadExpired = false;
      // Iteramos sobre las reservas del usuario actual para buscar notificaciones
      for (const res of userReservations) {
        if (res.details.status === 'expired' && res.details.isRead === false) {
          foundUnreadExpired = true;
          break; // Si encontramos una, no necesitamos buscar más
        }
      }
      this.hasUnreadExpiredReservations$.next(foundUnreadExpired);
    });

    // Tu suscripción existente para la fecha seleccionada
    this._selectedDateSource.pipe(
      takeUntil(this.destroy$)
    ).subscribe(date => {
      this.selectedDate = date;
    });
  }


  ngOnDestroy(): void {
    //this.subscriptions.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Maneja el evento de selección de fecha desde el MatDatepicker.
   * @param event El evento de cambio de fecha, contiene el objeto Date seleccionado.
   */
  onDateSelect(event: any): void {
    const selectedDate = event.value;

    // Validar si la fecha está disponible antes de emitirla.
    const formattedDate = this.formatDate(selectedDate);
    const availabilityEntry = this.allAvailabilityMap[formattedDate];

    // Si el día está reservado por OTRO usuario, muestra una alerta y no hace nada.
    // Si es tu propia reserva, permitimos la selección para ver los detalles.
    if (availabilityEntry && !availabilityEntry.available && availabilityEntry.bookedBy !== this.currentUserUid) {
      alert('¡Atención! Este día ya está reservado por otro usuario.');
      this.selectedDate = null; // Reinicia la fecha seleccionada para evitar errores
      return;
    }

    console.log("AgendaComponent: Fecha seleccionada del calendario (Objeto Date):", selectedDate);
    this._selectedDateSource.next(selectedDate);
  }

  /**
   * Formatea un objeto Date a una cadena "YYYY-MM-DD".
   * @param date El objeto Date a formatear.
   * @returns La fecha formateada como cadena.
   */
  public formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Cancela una reserva específica del usuario actual.
   * @param reservation La reserva a cancelar.
   */
  async cancelReservation(reservation: Reservation): Promise<void> {
    if (!confirm('¿Estás seguro de que quieres cancelar esta reserva? Esta acción no se puede deshacer.')) {
      return;
    }

    if (this.currentUserUid && reservation.details.userId === this.currentUserUid) {
      try {
        await this.firebaseService.cancelReservation(reservation.details.date, reservation.id);
        alert('Reserva cancelada exitosamente.');
        if (this.selectedDate) {
          this._selectedDateSource.next(this.selectedDate);
        }
      } catch (error) {
        console.error('Error al cancelar reserva:', error);
        alert('Hubo un error al cancelar la reserva. Por favor, intenta de nuevo.');
      }
    } else {
      alert('No tienes permiso para cancelar esta reserva.');
    }
  }

  /**
   * Comprueba si una reserva es "próxima".
   * @param reservation La reserva a verificar.
   * @param compareDate La fecha contra la cual comparar.
   * @returns True si la reserva es próxima, false en caso contrario.
   */
  isReservationUpcoming(reservation: Reservation, compareDate: Date | null = null): boolean {
    const reservationDate = new Date(reservation.details.date);
    reservationDate.setHours(0, 0, 0, 0);

    const actualCompareDate = compareDate ? new Date(compareDate) : new Date();
    actualCompareDate.setHours(0, 0, 0, 0);

    return reservationDate >= actualCompareDate;
  }

  /**
   * Comprueba si una fecha de reserva coincide con la fecha actualmente seleccionada.
   * @param reservationDateString La fecha de la reserva en formato "YYYY-MM-DD".
   * @returns True si la fecha de la reserva coincide con la seleccionada, false en caso contrario.
   */
  isReservationHighlighted(reservationDateString: string): boolean {
    if (!this.selectedDate) {
      return false;
    }
    const selectedFormattedDate = this.formatDate(this.selectedDate);
    return reservationDateString === selectedFormattedDate;
  }

  /**
   * AÑADIDO: Calcula los días restantes para la fecha límite de pago.
   * @param reservation La reserva a verificar.
   * @returns El número de días restantes o null si no aplica.
   */
  calculateDaysLeft(reservation: Reservation): number | null {
    // Si el estado no es 'pending', no hay plazo.
    if (reservation.details.status !== 'pending') {
      return null;
    }

    // Calcula la fecha de vencimiento (fecha de reserva + 1 mes).
    const reservationDate = new Date(reservation.details.date); // Fecha de la reserva
    const dueDate = new Date(reservationDate); // Copia de la fecha de la reserva

     // --- LÍNEA DE PRUEBA: ESTABLECE LA FECHA DE VENCIMIENTO A HACE 5 MINUTOS ---
    // Esto es solo para que puedas probar la cancelación
    // Vence 5 minutos después de que se creó la reserva (puedes ajustar esta lógica).
    // O puedes hacer que la fecha de vencimiento sea hoy para las pruebas.

    // Opción 1: para probar con reservas existentes, haz que la fecha de vencimiento sea hoy.
    // dueDate.setDate(today.getDate());

    // Opción 2: para probar con una nueva reserva, haz que la fecha de vencimiento sea 5 minutos después de la creación.
    // Necesitarás una marca de tiempo en la reserva para esto, como `reservation.details.createdAt`.

    // Por ahora, para simplificar, vamos a calcular la fecha de vencimiento como si fuera hoy si la reserva está cerca de la fecha.
    // Esto es solo un ejemplo, la lógica en el servidor es la que importa.


    /*dueDate.setDate(dueDate.getDate() - 7);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Opcional pero recomendado para una comparación precisa

    const timeDifference = dueDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

    return daysLeft;*/

    const timeDifference = reservationDate.getTime() - new Date().getTime();
    const daysLeft = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
    return daysLeft > 7 ? daysLeft - 7 : null; // Lógica simplificada solo para ejemplo
  }
}
