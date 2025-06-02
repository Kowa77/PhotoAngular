// src/app/agenda/agenda.component.ts

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { AuthService } from '../auth/auth.service';
import { Subscription, combineLatest, Observable, BehaviorSubject, Subject, of } from 'rxjs';
import { map, switchMap, filter, tap, takeUntil, distinctUntilChanged, catchError } from 'rxjs/operators';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

// Importar los tipos necesarios
import { Reservation, ReservationItem, ReservationDetails, DailyAvailabilityMap } from '../models/reservation.model';

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
  private destroy$: Subject<void> = new Subject<void>();
  currentUserUid: string | null = null;

  // BehaviorSubject para gestionar la fecha seleccionada por el usuario en el calendario
  private _selectedDateSource: BehaviorSubject<Date | null> = new BehaviorSubject<Date | null>(new Date());
  selectedDate: Date | null = null; // Propiedad para el ngModel en la plantilla del MatDatepicker

  // Array de reservas del usuario actual para la fecha seleccionada
  reservationsForSelectedDate: Reservation[] = [];

  // Mapa de disponibilidad diaria para colorear el calendario.
  // Este mapa es crucial para la función `dateClass` y se llena desde Firebase.
  allAvailabilityMap: DailyAvailabilityMap = {};

  startAt: Date;
  minDate: Date;
  maxDate: Date;

  // myReservaciones se mantiene, pero su llenado se centrará en lo que se necesite mostrar
  // (por ejemplo, una lista de todas las reservas futuras del usuario si se implementa un flujo para eso)
  myReservaciones: Reservation[] = [];

  constructor() {
    const today = new Date();
    this.minDate = new Date(today.getFullYear(), 0, 1); // El calendario empieza a mostrar desde el 1 de enero del año actual
    this.startAt = today; // El calendario se abre mostrando el mes actual
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 2); // El calendario muestra fechas hasta 2 años en el futuro
  }

  /**
   * Función utilizada por Angular Material Datepicker para aplicar clases CSS a los días.
   * Devuelve 'has-bookings' si el día está marcado como no disponible en Firebase.
   * @param date El objeto Date del día que se está renderizando en el calendario.
   * @returns Una cadena con las clases CSS a aplicar.
   */
  dateClass = (date: Date) => {
    const formattedDate = this.formatDate(date);
    // Verifica si la fecha existe en el mapa de disponibilidad y si su estado 'available' es falso.
    if (this.allAvailabilityMap[formattedDate] && this.allAvailabilityMap[formattedDate].available === false) {
      return 'has-bookings'; // Aplica esta clase para días reservados/no disponibles
    }
    return ''; // No aplica ninguna clase especial si el día está disponible o no hay datos.
  };

  ngOnInit(): void {
    // Suscripción principal para obtener el UID del usuario actual.
    // Esto se ejecuta al iniciar el componente y cada vez que el estado de autenticación cambia.
    this.authService.user$.pipe(
      map(user => user ? user.uid : null), // Extrae el UID del usuario, o null si no está autenticado
      tap(uid => this.currentUserUid = uid), // Almacena el UID en la propiedad del componente
      distinctUntilChanged(), // Solo emite si el UID realmente cambia
      takeUntil(this.destroy$) // Asegura que esta suscripción se desuscriba cuando el componente se destruya
    ).subscribe(uid => {
      if (uid) {
        // Si hay un usuario autenticado, cargar el mapa de disponibilidad global para el calendario.
        // allReservations$ del FirebaseService devuelve un DailyAvailabilityMap
        this.firebaseService.allReservations$().pipe(
          takeUntil(this.destroy$)
        ).subscribe(dailyAvailabilityMap => {
          this.allAvailabilityMap = dailyAvailabilityMap; // Actualiza el mapa de disponibilidad
          console.log("AgendaComponent: Mapa de disponibilidad global actualizado:", this.allAvailabilityMap);
        });

        // Configurar la fecha inicial del calendario si no hay ninguna seleccionada.
        // Por defecto, se establece en la fecha actual.
        if (!this.selectedDate) {
          this._selectedDateSource.next(new Date());
        } else {
          // Si ya hay una fecha seleccionada (ej. por navegación o recarga), re-emitirla
          // para asegurar que las reservas de esa fecha se carguen.
          this._selectedDateSource.next(this.selectedDate);
        }

      } else {
        // Si no hay usuario autenticado, limpiar todos los datos relacionados con reservas.
        this.myReservaciones = [];
        this.reservationsForSelectedDate = [];
        this.allAvailabilityMap = {};
        this._selectedDateSource.next(null); // Limpiar la fecha seleccionada o establecer a hoy si se prefiere
        console.log("AgendaComponent: Usuario deslogueado, limpiando datos de reservas.");
      }
    });

    // Suscripción para reaccionar a los cambios de la fecha seleccionada en el calendario.
    // Este flujo carga las reservas específicas para el usuario y la fecha seleccionada.
    this._selectedDateSource.pipe(
      filter(date => !!date), // Solo procesa si hay una fecha válida seleccionada
      map(date => this.formatDate(date as Date)), // Formatea el objeto Date a la cadena "YYYY-MM-DD"
      distinctUntilChanged(), // Solo procede si la fecha formateada es diferente a la última
      switchMap(formattedDate => {
        if (!this.currentUserUid) {
          console.log(`AgendaComponent: No hay UID de usuario para cargar reservas de ${formattedDate}.`);
          return of([]); // Si no hay usuario, devuelve un observable que emite un array vacío
        }
        // Llama al servicio para obtener todas las reservas para la fecha formateada.
        return this.firebaseService.getReservationsForDate(formattedDate).pipe(
          map(reservationsMap => Object.values(reservationsMap || {})), // Convierte el mapa de reservas a un array
          map(reservations => reservations.filter(res => res.details.userId === this.currentUserUid)), // Filtra para mostrar solo las reservas del usuario actual
          tap(reservations => {
            console.log(`AgendaComponent: Mis reservas para ${formattedDate}:`, reservations);
          }),
          catchError(error => { // Manejo de errores específico para esta llamada
            console.error(`AgendaComponent: Error al cargar reservas para ${formattedDate}:`, error);
            return of([]); // En caso de error, devuelve un array vacío para no romper el flujo
          }),
          takeUntil(this.destroy$) // Desuscribe la llamada interna cuando el componente se destruye
        );
      }),
      takeUntil(this.destroy$) // Desuscribe esta suscripción principal cuando el componente se destruye
    ).subscribe((reservations: Reservation[]) => { // Aquí se explicita el tipo de `reservations`
      this.reservationsForSelectedDate = reservations; // Asigna las reservas filtradas a la propiedad
    }, error => {
      console.error("AgendaComponent: Error en la suscripción principal del selector de fecha:", error);
      this.reservationsForSelectedDate = []; // Limpia las reservas en caso de error
    });

    // Sincroniza la propiedad `selectedDate` (para ngModel) con el valor del BehaviorSubject.
    this._selectedDateSource.pipe(
      takeUntil(this.destroy$)
    ).subscribe(date => {
      this.selectedDate = date;
    });
  }

  ngOnDestroy(): void {
    // Desuscribe todas las suscripciones agrupadas en `this.subscriptions`
    this.subscriptions.unsubscribe();
    // Emite un valor para el Subject `destroy$` para que `takeUntil` desuscriba todos los observables
    this.destroy$.next();
    // Completa el Subject `destroy$` para liberar recursos
    this.destroy$.complete();
  }

  /**
   * Maneja el evento de selección de fecha desde el MatDatepicker.
   * @param event El evento de cambio de fecha, contiene el objeto Date seleccionado.
   */
  onDateSelect(event: any): void {
    const selectedDate = event.value; // El valor del evento es un objeto Date
    console.log("AgendaComponent: Fecha seleccionada del calendario (Objeto Date):", selectedDate);
    this._selectedDateSource.next(selectedDate); // Emite la nueva fecha seleccionada al BehaviorSubject
  }

  /**
   * Formatea un objeto Date a una cadena "YYYY-MM-DD".
   * @param date El objeto Date a formatear.
   * @returns La fecha formateada como cadena.
   */
  public formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Meses son 0-indexados
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Cancela una reserva específica del usuario actual.
   * @param reservation La reserva a cancelar.
   */
  async cancelReservation(reservation: Reservation): Promise<void> {
    if (!confirm('¿Estás seguro de que quieres cancelar esta reserva? Esta acción no se puede deshacer.')) {
      return; // El usuario canceló la operación
    }

    // Verifica que haya un usuario autenticado y que la reserva pertenezca a ese usuario
    if (this.currentUserUid && reservation.details.userId === this.currentUserUid) {
      try {
        await this.firebaseService.cancelReservation(reservation.details.date, reservation.id);
        alert('Reserva cancelada exitosamente.');
        // Forzar una actualización de las reservas para la fecha actual
        // para que la UI se refresque instantáneamente después de la cancelación.
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
   * Comprueba si una reserva es "próxima" (es decir, su fecha es igual o posterior a una fecha de comparación).
   * @param reservation La reserva a verificar.
   * @param compareDate La fecha contra la cual comparar (opcional, por defecto es la fecha actual).
   * @returns True si la reserva es próxima, false en caso contrario.
   */
  isReservationUpcoming(reservation: Reservation, compareDate: Date | null = null): boolean {
    const reservationDate = new Date(reservation.details.date);
    reservationDate.setHours(0, 0, 0, 0); // Normaliza la fecha de reserva a inicio del día

    // Usa la fecha de comparación proporcionada, o la fecha actual si no se proporciona.
    const actualCompareDate = compareDate ? new Date(compareDate) : new Date();
    actualCompareDate.setHours(0, 0, 0, 0); // Normaliza la fecha de comparación a inicio del día

    return reservationDate >= actualCompareDate;
  }

  /**
   * Comprueba si una fecha de reserva coincide con la fecha actualmente seleccionada en el calendario.
   * Útil para resaltar reservas en una lista.
   * @param reservationDateString La fecha de la reserva en formato "YYYY-MM-DD".
   * @returns True si la fecha de la reserva coincide con la seleccionada, false en caso contrario.
   */
  isReservationHighlighted(reservationDateString: string): boolean {
    if (!this.selectedDate) {
      return false; // No hay fecha seleccionada para comparar
    }
    const selectedFormattedDate = this.formatDate(this.selectedDate);
    return reservationDateString === selectedFormattedDate; // Compara las cadenas de fecha
  }
}
