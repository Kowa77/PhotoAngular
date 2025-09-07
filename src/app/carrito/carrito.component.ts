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

// Importa los módulos de Material aquí
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';


declare const Swal: any;


@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatFormFieldModule // Asegúrate de que este módulo esté aquí
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
  ]

})
export class CarritoComponent implements OnInit, OnDestroy {
  private firebaseService: FirebaseService = inject(FirebaseService);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);

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

  // --- NUEVAS PROPIEDADES PARA LA LÓGICA DE PAGO ---
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

      console.log('CarritoComponent: Processing with cartData and allServicios.', cartData, allServicios);

      if (cartData && Object.keys(cartData).length > 0 && allServicios.length > 0) {
        const items: { [serviceId: string]: CartItem } = {};
        let total = 0;
        let itemsProcessedCount = 0;

        for (const serviceId in cartData) {
          if (cartData.hasOwnProperty(serviceId)) {
            const entry = cartData[serviceId];
            const servicio = allServicios.find((s: Servicio) => s.id === serviceId);

            console.log(`CarritoComponent: Processing serviceId: ${serviceId}, entry:`, entry, 'Found service:', servicio);

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
              itemsProcessedCount++;
            } else {
              console.warn(`CarritoComponent: Service with ID ${serviceId} no encontrado en catálogo.`);
            }
          }
        }
        this.cart = { items, total };
        this.updateCartDisplayData();
        this.calculatePaymentTotals();
        console.log(`CarritoComponent: Procesados ${itemsProcessedCount} items. Carrito final:`, this.cart);
      } else {
        console.log('CarritoComponent: cartData o allServicios vacíos, setEmptyCart.');
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
    tap(data => console.log('CarritoComponent: Daily availability data received:', data)),
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
    console.log('CarritoComponent: ngOnDestroy - Desuscribiendo.');
    if (this.mainSubscription) {
      this.mainSubscription.unsubscribe();
    }
    if (this.availabilitySubscription) {
      this.availabilitySubscription.unsubscribe();
    }
    this.userUidSubject.complete();
  }

  private setEmptyCart(): void {
    this.cart = { items: {}, total: 0 };
    this.updateCartDisplayData();
    this.calculatePaymentTotals();
    console.log('CarritoComponent: setEmptyCart called. cartItemsArray:', this.cartItemsArray.length, 'Total:', this.currentCartTotal);
  }

  private updateCartDisplayData(): void {
    this.cartItemsArray = this.cart ? Object.values(this.cart.items) : [];
    this.currentCartTotal = this.cart ? this.cart.total : 0;
    console.log('CarritoComponent: Cart display data updated. Items:', this.cartItemsArray.length, 'Total:', this.currentCartTotal);
  }

  // --- NUEVA LÓGICA DE CÁLCULO DE PAGOS ---
  private calculatePaymentTotals(): void {
    if (this.cart && this.cart.total > 0) {
      this.totalWithDiscount = this.cart.total * 0.8; // 20% de descuento
      this.partialTotal = this.cart.total * 0.2; // 20% de pago de reserva
    } else {
      this.totalWithDiscount = 0;
      this.partialTotal = 0;
    }
    console.log(`CarritoComponent: Totales de pago calculados. Completo: ${this.totalWithDiscount}, Parcial: ${this.partialTotal}`);
  }

  updateSummary(): void {
    // Esta función no hace nada por ahora, pero sirve como "hook" para futuras lógicas si el usuario lo pide.
    // Solo actualiza los valores en el HTML cuando se selecciona una opción.
  }

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
        console.log(`CarritoComponent: Cantidad de ${serviceId} actualizada a ${newQuantity} en Firebase.`);
      }
    }
  }

  async removeFromCart(serviceId: string): Promise<void> {
    if (this.currentUserUid && this.cart && this.cart.items) {
      await this.firebaseService.quitarDelCarrito(this.currentUserUid, serviceId);
      console.log(`CarritoComponent: Servicio ${serviceId} eliminado de Firebase.`);
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
    console.log('Fecha seleccionada del Datepicker (Angular Material):', this.selectedReservationDate);
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

  // Bloquear si no eligió tipo de pago todavía
  if (!this.paymentOption) {
    return false; // <- aquí sí está perfecto
  }

  const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 🔒 siempre deshabilita días pasados
  if (currentDate < today) {
    return false;
  }

  // 🔒 restricción de +3 días solo para pago parcial
  if (this.paymentOption === 'partial') {
    const minDatePartial = new Date(today);
    minDatePartial.setDate(today.getDate() + 3);
    if (currentDate < minDatePartial) {
      return false;
    }
  }

  const formattedDate = this.formatDateToYYYYMMDD(date);
  const availability = this.allAvailabilityMap[formattedDate];

  // Si no hay disponibilidad registrada, está libre
  return !availability || availability.available === true;
};

async proceedToCheckout(): Promise<void> {
  console.log('CarritoComponent: Starting proceedToCheckout...');

  if (!this.currentUserUid) {
    console.warn('You must log in to proceed with the reservation.');
    this.router.navigate(['/auth']);
    return;
  }

  if (!this.cartItemsArray || this.cartItemsArray.length === 0) {
    console.warn('Your cart is empty. Add services before proceeding.');
    Swal.fire("Your cart is empty. Add services before proceeding.");
    return;
  }

  if (!this.selectedReservationDate) {
    console.warn('Please select a date for your reservation.');
    Swal.fire("Please select a date for your reservation.");
    return;
  }

  const formattedDate = this.formatDateToYYYYMMDD(this.selectedReservationDate);
  const selectedDayAvailability = this.allAvailabilityMap[formattedDate];

  if (selectedDayAvailability && selectedDayAvailability.available === false && selectedDayAvailability.bookedBy !== this.currentUserUid) {
    console.warn('The selected date has already been reserved by another user. Please choose another date.');
    Swal.fire("The selected date has already been reserved by another user. Please choose another date.");
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

    // Total y estado según la opción de pago
    const totalToSave = this.paymentOption === 'full' ? this.totalWithDiscount : this.partialTotal;
    const reservationStatus = this.paymentOption === 'full' ? 'confirmed' : 'pending';

    console.log('CarritoComponent: Preparing to save reservation with the following details:', {
      paymentOption: this.paymentOption,
      total: totalToSave,
      status: reservationStatus
    });

    const reservationId = await this.firebaseService.saveReservation(
      this.currentUserUid,
      formattedDate,
      reservationItems,
      totalToSave,
      reservationStatus
    );

    // 🔥 Mensajes diferenciados
    if (reservationStatus === 'confirmed') {
      Swal.fire({
        icon: 'success',
        title: '¡Pago exitoso!',
        text: 'Tu pago fue procesado y la reserva quedó confirmada.',
      });
    } else {
      Swal.fire({
        icon: 'info',
        title: 'Reserva registrada',
        text: 'Tu reserva fue guardada. Recuerda que tienes 2 días para realizar el pago antes de que expire.',
      });
    }

    await this.firebaseService.guardarCarritoUsuario(this.currentUserUid, {});
    this.setEmptyCart();
    this.selectedReservationDate = null;

    console.log(`Reservation successfully made! Reservation ID: ${reservationId}. You can view your reservations in the Agenda.`);
    this.router.navigate(['/agenda']);
  } catch (error: any) {
    console.error('CarritoComponent: Error processing reservation:', error);
    Swal.fire("Error", error.message || "Hubo un error inesperado. Por favor, intenta de nuevo.", "error");
  }
}

}
