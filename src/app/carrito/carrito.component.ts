import { Component, OnInit, OnDestroy, inject, ViewEncapsulation, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Router } from '@angular/router';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Subscription, combineLatest, of, BehaviorSubject } from 'rxjs';
import { switchMap, tap, catchError, map, distinctUntilChanged, filter } from 'rxjs/operators';
import { Cart, CartItem } from '../models/cart.model';
import { ReservationItem, DailyAvailabilityMap } from '../models/reservation.model';
import { Servicio } from '../models/servicio.model';
import { AuthService } from '../auth/auth.service';

declare var MercadoPago: any; // SDK ya está cargado en index.html
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

// Importa los módulos de Material aquí
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';

declare const Swal: any;

export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'dd/MM/yyyy',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatFormFieldModule
  ],
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.css'],
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
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-ES' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ]
})
export class CarritoComponent implements OnInit, OnDestroy {
  private firebaseService: FirebaseService = inject(FirebaseService);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);
  private http: HttpClient = inject(HttpClient);

  cart: Cart | null = null;
  public currentUserUid: string | null = null;

  public isLoading: boolean = true;
  private userUidSubject = new BehaviorSubject<string | null>(null);

  private mainSubscription: Subscription | null = null;
  private availabilitySubscription: Subscription | null = null;

  selectedDate: Date | null = null;
  selectedReservationDate: Date | null = null;
  startAt: Date;
  minDate: Date;
  maxDate: Date;

  allAvailabilityMap: DailyAvailabilityMap = {};
  cartItemsArray: CartItem[] = [];
  currentCartTotal: number = 0;

  // --- NUEVAS PROPIEDADES ---
  paymentOption: 'full' | 'partial' | null = null;
  totalWithDiscount: number = 0;
  partialTotal: number = 0;

  constructor() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.minDate = today;
    this.startAt = this.minDate;
    this.maxDate = new Date(today);
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 2);
  }

  ngOnInit(): void {
    console.log('CarritoComponent: ngOnInit - Iniciando carga de carrito.');
    this.isLoading = true;

    this.authService.user$
      .pipe(distinctUntilChanged((a, b) => a?.uid === b?.uid))
      .subscribe(user => {
        this.currentUserUid = user ? user.uid : null;
        this.userUidSubject.next(this.currentUserUid);
      });

    this.mainSubscription = this.userUidSubject.pipe(
      filter(uid => uid !== undefined),
      tap(uid => console.log('CarritoComponent: userUidSubject emitió:', uid)),
      switchMap(uid => {
        if (!uid) {
          console.log('CarritoComponent: No hay usuario autenticado, carrito vacío.');
          return of({
            cartData: {} as { [serviceId: string]: { cantidad: number; duracion?: number } },
            allServicios: [] as Servicio[]
          });
        }

        console.log(`CarritoComponent: Usuario UID ${uid} conocido. Procediendo a cargar datos.`);
        return combineLatest([
          this.firebaseService.obtenerCarritoUsuario(uid).pipe(
            tap(data => console.log('CarritoComponent: Raw cartData received from FirebaseService:', data)),
            catchError(error => {
              console.error('CarritoComponent: Error fetching user cart:', error);
              return of({} as { [serviceId: string]: { cantidad: number; duracion?: number } });
            })
          ),
          this.firebaseService.getTodosLosServicios().pipe(
            tap(data => console.log('CarritoComponent: allServicios loaded:', data)),
            catchError(error => {
              console.error('CarritoComponent: Error fetching all services:', error);
              return of([] as Servicio[]);
            })
          )
        ]).pipe(
          map(([cartData, allServicios]) => ({ cartData, allServicios })),
          tap(() => console.log('CarritoComponent: combineLatest emitió datos para procesamiento.')),
          catchError(error => {
            console.error('CarritoComponent: Error en combineLatest:', error);
            this.isLoading = false;
            return of({
              cartData: {} as { [serviceId: string]: { cantidad: number; duracion?: number } },
              allServicios: [] as Servicio[]
            });
          })
        );
      })
    ).subscribe(
      ({ cartData, allServicios }) => {
        if (!this.currentUserUid) {
          console.log('CarritoComponent: Procesamiento abortado, currentUserUid null.');
          this.setEmptyCart();
          this.isLoading = false;
          return;
        }

        if (cartData && Object.keys(cartData).length > 0 && allServicios.length > 0) {
          const items: { [serviceId: string]: CartItem } = {};
          let total = 0;

          for (const serviceId in cartData) {
            if (cartData.hasOwnProperty(serviceId)) {
              const entry = cartData[serviceId];
              const servicio = allServicios.find((s: Servicio) => s.id === serviceId);

              if (servicio) {
                items[serviceId] = {
                  id: servicio.id,
                  nombre: servicio.nombre,
                  descripcion: servicio.descripcion,
                  precio: servicio.precio,
                  cantidad: entry.cantidad,
                  imagen: servicio.imagen,
                  categoria: servicio.categoria,
                  duracion: entry.duracion ?? null,
                };
                total += servicio.precio * entry.cantidad * (entry.duracion ?? 1);
              }
            }
          }
          this.cart = { items, total };
          this.updateCartDisplayData();
          this.calculatePaymentTotals();
        } else {
          this.setEmptyCart();
        }
        this.isLoading = false;
      },
      (error) => {
        console.error('CarritoComponent: Major error in main subscription:', error);
        this.setEmptyCart();
        this.isLoading = false;
      }
    );

    this.availabilitySubscription = this.firebaseService.allReservations$().pipe(
      catchError(error => {
        console.error('CarritoComponent: Error fetching daily availability:', error);
        return of({});
      }),
    ).subscribe(
      (availabilityMap: DailyAvailabilityMap) => {
        this.allAvailabilityMap = availabilityMap;
      },
      (error) => {
        console.error('CarritoComponent: Error in availability subscription:', error);
      }
    );
  }

  ngOnDestroy(): void {
    if (this.mainSubscription) this.mainSubscription.unsubscribe();
    if (this.availabilitySubscription) this.availabilitySubscription.unsubscribe();
    this.userUidSubject.complete();
  }

  private setEmptyCart(): void {
    this.cart = { items: {}, total: 0 };
    this.updateCartDisplayData();
    this.calculatePaymentTotals();
  }

  private updateCartDisplayData(): void {
    this.cartItemsArray = this.cart ? Object.values(this.cart.items) : [];
    this.currentCartTotal = this.cart ? this.cart.total : 0;
  }

  private calculatePaymentTotals(): void {
    if (this.cart && this.cart.total > 0) {
      this.totalWithDiscount = this.cart.total * 0.8;
      this.partialTotal = this.cart.total * 0.2;
    } else {
      this.totalWithDiscount = 0;
      this.partialTotal = 0;
    }
  }

  updateSummary(): void {}

  trackByItemId(index: number, item: CartItem): string {
    return item.id;
  }

  async updateQuantity(serviceId: string, event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const newQuantity = parseInt(target.value, 10);

    if (this.currentUserUid && this.cart && this.cart.items && newQuantity >= 1) {
      const currentItem = this.cart.items[serviceId];
      if (currentItem) {
        const updatedFirebaseCart: { [key: string]: number } = {};
        for (const key in this.cart.items) {
          if (this.cart.items.hasOwnProperty(key)) {
            updatedFirebaseCart[key] = this.cart.items[key].cantidad;
          }
        }
        updatedFirebaseCart[serviceId] = newQuantity;
        await this.firebaseService.guardarCarritoUsuario(this.currentUserUid, updatedFirebaseCart);
      }
    }
  }

  async removeFromCart(serviceId: string): Promise<void> {
    if (this.currentUserUid && this.cart && this.cart.items) {
      await this.firebaseService.quitarDelCarrito(this.currentUserUid, serviceId);
    }
  }

  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDateSelect(event: any): void {
    this.selectedReservationDate = event.value;
  }

  dateClass = (date: Date): string => {
    const formattedDate = this.formatDateToYYYYMMDD(date);
    const availability = this.allAvailabilityMap[formattedDate];
    let classes = '';

    if (availability && availability.available === false) {
      if (this.currentUserUid && availability.bookedBy === this.currentUserUid) {
        classes += ' booked-by-current-user';
      } else {
        classes += ' booked-by-others';
      }
    }
    return classes.trim();
  };

  dateFilter = (date: Date | null): boolean => {
    if (!date) return false;
    if (!this.paymentOption) return false;

    const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (currentDate < today) return false;

    if (this.paymentOption === 'partial') {
      const minDatePartial = new Date(today);
      minDatePartial.setDate(today.getDate() + 3);
      if (currentDate < minDatePartial) return false;
    }

    const formattedDate = this.formatDateToYYYYMMDD(date);
    const availability = this.allAvailabilityMap[formattedDate];
    return !availability || availability.available === true;
  };

  // --- MERCADOPAGO ---
async proceedToCheckout(): Promise<void> {
  if (!this.currentUserUid) {
    Swal.fire('Debes iniciar sesión para continuar');
    this.router.navigate(['/auth']);
    return;
  }

  if (!this.cartItemsArray || this.cartItemsArray.length === 0) {
    Swal.fire('Tu carrito está vacío.');
    return;
  }

  if (!this.selectedReservationDate) {
    Swal.fire('Selecciona una fecha para la reserva.');
    return;
  }

  if (!this.paymentOption) {
    Swal.fire('Selecciona una opción de pago.');
    return;
  }

  const formattedDate = this.formatDateToYYYYMMDD(this.selectedReservationDate);
  const selectedDayAvailability = this.allAvailabilityMap[formattedDate];

  if (
    selectedDayAvailability &&
    selectedDayAvailability.available === false &&
    selectedDayAvailability.bookedBy !== this.currentUserUid
  ) {
    Swal.fire('La fecha ya está reservada por otro usuario.');
    return;
  }

  try {
    const reservationItems: ReservationItem[] = this.cartItemsArray.map(cartItem => ({
      id: cartItem.id,
      nombre: cartItem.nombre,
      descripcion: cartItem.descripcion,
      precio: cartItem.precio,
      cantidad: cartItem.cantidad,
      imagen: cartItem.imagen,
      categoria: cartItem.categoria,
      duracion: cartItem.duracion ?? null
    }));

    const amount = this.paymentOption === 'full' ? this.totalWithDiscount : this.partialTotal;

    // Guardar reserva preliminar en Firebase
    const reservationId = await this.firebaseService.saveReservation(
      this.currentUserUid!,
      formattedDate,
      reservationItems,
      amount,
      'pending',
      this.paymentOption!,
      this.partialTotal
    );

    // Crear preferencia en backend
    const pref: any = await this.http
      .post(`${environment.apiUrl}/create_preference`, {
        title: `Reserva ${formattedDate}`,
        quantity: 1,
        price: amount,
        reservationId,
        userId: this.currentUserUid,
        mode: this.paymentOption
      })
      .toPromise();

    if (!pref?.id) throw new Error('Error al crear preferencia de MercadoPago');

    // 🔥 Ahora pref trae también reservationId y userId (re-confirmados desde backend)
    console.log('Preferencia creada:', pref);

    const mp = new MercadoPago(environment.mercadoPagoPublicKey, { locale: 'es-UY' });
    mp.checkout({
      preference: { id: pref.id },
      autoOpen: true
    });

    Swal.fire('Redirigiendo a MercadoPago...', '', 'info');
  } catch (error: any) {
    console.error('Error en proceedToCheckout:', error);
    Swal.fire('Error', error.message || 'No se pudo iniciar el pago', 'error');
  }
}

}
