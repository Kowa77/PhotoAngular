import { Component, OnInit, OnDestroy, inject, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { AuthService } from '../auth/auth.service';
import { BehaviorSubject, Subject, of, combineLatest } from 'rxjs';
import { map, switchMap, filter, takeUntil, distinctUntilChanged, catchError } from 'rxjs/operators';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

import { trigger, transition, style, animate } from '@angular/animations';

// Importar los tipos necesarios
import { Reservation, DailyAvailabilityMap } from '../models/reservation.model';

// 🔥 MercadoPago
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

declare var MercadoPago: any;
declare const Swal: any;

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
    FormsModule,
  ],
  encapsulation: ViewEncapsulation.None,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' }))
      ])
    ])
  ]
})
export class AgendaComponent implements OnInit, OnDestroy {
  private firebaseService: FirebaseService = inject(FirebaseService);
  private authService: AuthService = inject(AuthService);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private http: HttpClient = inject(HttpClient);

  private destroy$: Subject<void> = new Subject<void>();
  currentUserUid: string | null = null;
  currentUserEmail: string | null = null;

  private _selectedDateSource: BehaviorSubject<Date | null> =
    new BehaviorSubject<Date | null>(new Date());
  public hasUnreadExpiredReservations$ = new BehaviorSubject<boolean>(false);
  selectedDate: Date | null = null;

  reservationsForSelectedDate: Reservation[] = [];
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

  dateFilter = (date: Date | null): boolean => {
    if (!date) return false;
    const formattedDate = this.formatDate(date);
    const availabilityEntry = this.allAvailabilityMap[formattedDate];
    return !availabilityEntry || availabilityEntry.available;
  };

  dateClass = (date: Date): string => {
    const formattedDate = this.formatDate(date);
    const availabilityEntry = this.allAvailabilityMap[formattedDate];
    if (
      availabilityEntry &&
      availabilityEntry.available === false &&
      availabilityEntry.bookedBy === this.currentUserUid
    ) {
      return 'has-bookings';
    }
    return '';
  };

  goToReservation(reservation: Reservation): void {
    const dateParts = reservation.details.date.split('-');
    const date = new Date(
      Number(dateParts[0]),
      Number(dateParts[1]) - 1,
      Number(dateParts[2])
    );
    this.onDateSelect({ value: date }, true);
    setTimeout(() => {
      const el = document.querySelector('.reservations-list-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  }

  ngOnInit(): void {
    this.firebaseService
      .allReservations$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((dailyAvailabilityMap: DailyAvailabilityMap) => {
        this.allAvailabilityMap = dailyAvailabilityMap;
        this.cdr.detectChanges();
      });

    this.authService.user$
      .pipe(
        map((user) =>
          user ? { uid: user.uid, email: user.email } : { uid: null, email: null }
        ),
        distinctUntilChanged((prev, curr) => prev.uid === curr.uid),
        takeUntil(this.destroy$)
      )
      .subscribe((user) => {
        this.currentUserUid = user.uid;
        this.currentUserEmail = user.email;
        if (!user.uid) {
          this.myReservaciones = [];
          this.reservationsForSelectedDate = [];
        }
        this._selectedDateSource.next(this.selectedDate);
        this.cdr.detectChanges();
      });

    combineLatest([
      this._selectedDateSource.pipe(filter((date): date is Date => !!date)),
      this.authService.user$.pipe(
        map((user) => (user ? user.uid : null)),
        distinctUntilChanged()
      ),
    ])
      .pipe(
        map(([date, uid]) => ({
          formattedDate: this.formatDate(date),
          uid,
        })),
        distinctUntilChanged(
          (prev, curr) =>
            prev.formattedDate === curr.formattedDate && prev.uid === curr.uid
        ),
        switchMap(({ formattedDate, uid }) => {
          if (!uid) return of<Reservation[]>([]);
          return this.firebaseService.getReservationsForDate(formattedDate).pipe(
            map((reservationsMap) => Object.values(reservationsMap || {})),
            map((reservations: Reservation[]) =>
              reservations.filter((res: Reservation) => res.details.userId === uid)
            ),
            catchError(() => of<Reservation[]>([])),
            takeUntil(this.destroy$)
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(
        (reservations: Reservation[]) => {
          this.reservationsForSelectedDate = reservations;
        },
        () => {
          this.reservationsForSelectedDate = [];
        }
      );

    this.authService.user$
      .pipe(
        map((user) => user?.uid),
        distinctUntilChanged(),
        switchMap((uid) => {
          if (!uid) return of<Reservation[]>([]);
          return this.firebaseService.getUserReservations(uid);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((userReservations: Reservation[]) => {
        const foundUnreadExpired = userReservations.some(
          (res: Reservation) =>
            res.details.status === 'expired' && res.details.isRead === false
        );
        this.hasUnreadExpiredReservations$.next(foundUnreadExpired);
        this.myReservaciones = userReservations;
      });

    this._selectedDateSource
      .pipe(takeUntil(this.destroy$))
      .subscribe((date: Date | null) => {
        this.selectedDate = date;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDateSelect(event: any, viewOnly: boolean = false): void {
    const selectedDate = event.value;
    if (!selectedDate) return;

    if (!viewOnly) {
      if (selectedDate < this.minDate) {
        alert('Solo puedes reservar a partir de 3 días desde hoy.');
        this.selectedDate = null;
        return;
      }
      const formattedDate = this.formatDate(selectedDate);
      const availabilityEntry = this.allAvailabilityMap[formattedDate];
      if (
        availabilityEntry &&
        !availabilityEntry.available &&
        availabilityEntry.bookedBy !== this.currentUserUid
      ) {
        alert('¡Atención! Este día ya está reservado por otro usuario.');
        this.selectedDate = null;
        return;
      }
    }
    this.selectedDate = selectedDate;
    this._selectedDateSource.next(selectedDate);
  }

  public formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async cancelReservation(reservation: Reservation): Promise<void> {
    if (
      !confirm(
        '¿Estás seguro de que quieres cancelar esta reserva? Esta acción no se puede deshacer.'
      )
    ) {
      return;
    }
    if (this.currentUserUid && reservation.details.userId === this.currentUserUid) {
      try {
        await this.firebaseService.cancelReservation(
          reservation.details.date,
          reservation.id
        );
        alert('Reserva cancelada exitosamente.');
        if (this.selectedDate) {
          this._selectedDateSource.next(this.selectedDate);
        }
      } catch (error) {
        console.error('Error al cancelar reserva:', error);
        alert('Hubo un error al cancelar la reserva.');
      }
    } else {
      alert('No tienes permiso para cancelar esta reserva.');
    }
  }

  isReservationUpcoming(reservation: Reservation, compareDate: Date | null = null): boolean {
    const reservationDate = new Date(reservation.details.date);
    reservationDate.setHours(0, 0, 0, 0);
    const actualCompareDate = compareDate ? new Date(compareDate) : new Date();
    actualCompareDate.setHours(0, 0, 0, 0);
    return reservationDate >= actualCompareDate;
  }

  isReservationHighlighted(reservationDateString: string): boolean {
    if (!this.selectedDate) return false;
    const selectedFormattedDate = this.formatDate(this.selectedDate);
    return reservationDateString === selectedFormattedDate;
  }

  calculateDaysLeft(reservation: Reservation): number | null {
    if (reservation.details.status !== 'pending') return null;
    const reservationDate = new Date(reservation.details.date);
    const dueDate = new Date(reservationDate);
    dueDate.setDate(reservationDate.getDate() - 2);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timeDifference = dueDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
    return daysLeft < 0 ? null : daysLeft;
  }

  // --- NUEVO: pago del 80% restante ---
  async payRemaining(reservation: Reservation): Promise<void> {
    if (!this.currentUserUid) {
      Swal.fire('Debes iniciar sesión');
      return;
    }
    try {
      const total = reservation.details.totalAmount || 0;
      const paid = reservation.details.paidAmount || (total * 0.2);
      const remaining = total - paid;
      if (remaining <= 0) {
        Swal.fire('No tienes pagos pendientes.');
        return;
      }
      const pref: any = await this.http.post(`${environment.apiUrl}/create_preference`, {
        title: `Pago restante de reserva ${reservation.id}`,
        quantity: 1,
        price: remaining,
        reservationId: reservation.id,
        userId: this.currentUserUid,
        mode: 'remaining'
      }).toPromise();
      if (!pref?.id) throw new Error('No se recibió id de preferencia');
      const mp = new MercadoPago(environment.mercadoPagoPublicKey, { locale: 'es-UY' });
      mp.checkout({ preference: { id: pref.id }, autoOpen: true });
      Swal.fire('Procesando pago...', 'Se abrirá MercadoPago para completar tu pago.', 'info');
    } catch (err: any) {
      console.error('Error en payRemaining:', err);
      Swal.fire('Error', err.message || 'No se pudo iniciar el pago del restante.', 'error');
    }
  }
}
