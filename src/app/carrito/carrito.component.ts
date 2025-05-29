// src/app/carrito/carrito.component.ts

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Subscription, combineLatest, of } from 'rxjs';
import { switchMap, tap, catchError, map } from 'rxjs/operators';
import { Cart, CartItem } from '../models/cart.model';
import { ReservationItem } from '../models/reservation.model';
import { Servicio } from '../models/servicio.model';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
// Remove MatDatepickerModule, MatNativeDateModule, MatFormFieldModule, MatInputModule imports
// if you are not using Angular Material's date picker components.
// If you use other Material components, keep their specific imports.
// For now, I'll comment them out as they are not relevant to the native date input.
// import { MatDatepickerModule } from '@angular/material/datepicker';
// import { MatNativeDateModule } from '@angular/material/core';
// import { MatFormFieldModule } from '@angular/material/form-field';
// import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    // MatDatepickerModule, // Comment out if not using Angular Material Datepicker
    // MatNativeDateModule, // Comment out if not using Angular Material Datepicker
    // MatFormFieldModule,  // Comment out if not using Angular Material Datepicker
    // MatInputModule,      // Comment out if not using Angular Material Datepicker
  ],
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.css'],
})
export class CarritoComponent implements OnInit, OnDestroy {
  private firebaseService: FirebaseService = inject(FirebaseService);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);

  cart: Cart | null = null;
  currentUserUid: string | null = null;
  private mainSubscription: Subscription | null = null;

  // Change type to string | null as native input type="date" returns a string
  selectedReservationDate: string | null = null;
  minDate: Date; // Keep these as Date objects for logic, but format for HTML binding
  maxDate: Date;

  constructor() {
    const today = new Date();
    this.minDate = today;
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 2);
  }

  ngOnInit(): void {
    console.log('CarritoComponent: ngOnInit - Iniciando carga de carrito.');

    this.mainSubscription = this.authService.user$.pipe(
      tap(user => {
        this.currentUserUid = user ? user.uid : null;
        console.log('CarritoComponent: currentUserUid:', this.currentUserUid);
        if (!this.currentUserUid) {
          console.log('CarritoComponent: No hay usuario autenticado, limpiando carrito.');
          this.cart = { items: {}, total: 0 };
        }
      }),
      switchMap(user => {
        if (!user) {
          return of({ cartData: {} as Record<string, number>, allServicios: [] as Servicio[] });
        }
        return combineLatest([
          this.firebaseService.obtenerCarritoUsuario(user.uid).pipe(
            tap(data => console.log('CarritoComponent: Raw cartData received from FirebaseService:', data)),
            catchError(error => {
              console.error('CarritoComponent: Error fetching user cart:', error);
              return of({} as Record<string, number>);
            })
          ),
          this.firebaseService.getServicios().pipe(
            tap(data => console.log('CarritoComponent: allServicios loaded (from combineLatest):', data)),
            catchError(error => {
              console.error('CarritoComponent: Error fetching all services:', error);
              return of([] as Servicio[]);
            })
          )
        ]).pipe(
          map(([cartData, allServicios]: [Record<string, number>, Servicio[]]) => ({ cartData, allServicios }))
        );
      })
    ).subscribe(
      ({ cartData, allServicios }) => {
        if (!this.currentUserUid) {
          console.log('CarritoComponent: Carrito limpiado porque no hay usuario (re-check).');
          this.cart = { items: {}, total: 0 };
          return;
        }

        console.log('CarritoComponent: Processing with cartData and allServicios.');
        console.log('  cartData:', cartData);
        console.log('  allServicios:', allServicios);

        if (cartData && Object.keys(cartData).length > 0 && allServicios && allServicios.length > 0) {
          const items: { [serviceId: string]: CartItem } = {};
          let total = 0;
          let itemsProcessedCount = 0;

          for (const serviceId in cartData) {
            if (cartData.hasOwnProperty(serviceId)) {
              const cantidad = cartData[serviceId];
              const servicio = allServicios.find((s: Servicio) => s.id === serviceId);

              console.log(`CarritoComponent: Processing serviceId: ${serviceId}, Quantity: ${cantidad}, Found service:`, servicio);

              if (servicio) {
                items[serviceId] = {
                  id: servicio.id,
                  nombre: servicio.nombre,
                  descripcion: servicio.descripcion,
                  precio: servicio.precio,
                  cantidad: cantidad,
                  imagen: servicio.imagen,
                  categoria: servicio.categoria,
                  duracion: typeof servicio.duracion === 'string' ? Number(servicio.duracion) : servicio.duracion
                };
                total += servicio.precio * cantidad;
                itemsProcessedCount++;
              } else {
                console.warn(`CarritoComponent: Service with ID ${serviceId} from cart not found in all services. It will NOT be added to the visible cart.`);
              }
            }
          }
          this.cart = { items, total };
          console.log(`CarritoComponent: Successfully processed ${itemsProcessedCount} items. Final visible cart:`, this.cart);
        } else {
          console.log('CarritoComponent: CartData or allServicios is empty/null, setting cart as empty locally.');
          this.cart = { items: {}, total: 0 };
        }
        console.log('CarritoComponent: After update, cartItemsArray.length is:', this.cartItemsArray.length);
      },
      (error) => {
        console.error('CarritoComponent: Major error in main subscription:', error);
        this.cart = { items: {}, total: 0 };
      }
    );
  }

  ngOnDestroy(): void {
    console.log('CarritoComponent: ngOnDestroy - Desuscribiendo.');
    if (this.mainSubscription) {
      this.mainSubscription.unsubscribe();
    }
  }

  get cartItemsArray(): CartItem[] {
    const items = this.cart ? Object.values(this.cart.items) : [];
    console.log('CarritoComponent: cartItemsArray calculated (getter):', items.length, items);
    return items;
  }

  get totalCarrito(): number {
    return this.cart ? this.cart.total : 0;
  }

  trackByItemId(item: CartItem): string {
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

  private formatDate(date: Date): string {
    // This function now *expects* a Date object. The conversion happens in proceedToCheckout.
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async proceedToCheckout(): Promise<void> {
    console.log('CarritoComponent: Iniciando proceedToCheckout...');

    if (!this.currentUserUid) {
      alert('Debes iniciar sesión para proceder con la reserva.');
      this.router.navigate(['/auth']);
      return;
    }

    if (!this.cartItemsArray || this.cartItemsArray.length === 0) {
      alert('Tu carrito está vacío. Añade servicios antes de proceder.');
      console.warn('CarritoComponent: Abortando checkout porque cartItemsArray está vacío.');
      return;
    }

    console.log('DEBUG: selectedReservationDate from HTML (string):', this.selectedReservationDate);
    console.log('DEBUG: typeof selectedReservationDate:', typeof this.selectedReservationDate);


    // Check if a date string exists
    if (!this.selectedReservationDate) {
      alert('Por favor, selecciona una fecha para tu reserva.');
      console.warn('CarritoComponent: Abortando checkout porque selectedReservationDate (string) está vacío.');
      return;
    }

    // Convert the string from the native input to a Date object
    const parsedDate = new Date(this.selectedReservationDate);

    console.log('DEBUG: Parsed Date object:', parsedDate);
    console.log('DEBUG: instanceof Date:', parsedDate instanceof Date);
    console.log('DEBUG: isNaN(parsedDate.getTime()):', isNaN(parsedDate.getTime()));


    // Validate if the parsedDate is a valid Date object
    if (!(parsedDate instanceof Date) || isNaN(parsedDate.getTime())) {
      alert('La fecha seleccionada no es válida. Por favor, asegúrate de seleccionarla correctamente.');
      console.error('CarritoComponent: Fecha seleccionada inválida después de parseo:', this.selectedReservationDate);
      return;
    }

    const formattedDate = this.formatDate(parsedDate); // Pass the validated Date object
    console.log(`CarritoComponent: Fecha seleccionada formateada: ${formattedDate}`);

    try {
      console.log(`CarritoComponent: Verificando si ya existe una reserva para el usuario ${this.currentUserUid} en la fecha ${formattedDate}...`);
      const hasExistingReservation = await this.firebaseService.hasReservationForDate(this.currentUserUid, formattedDate).toPromise();

      console.log(`CarritoComponent: Resultado de la verificación de reserva existente: ${hasExistingReservation}`);

      if (hasExistingReservation) {
        alert('¡Ya tienes una reserva para el día ' + formattedDate + '!\nDebes cancelar tu reserva existente antes de realizar una nueva para esta fecha.');
        return;
      }

      const reservationItems: ReservationItem[] = this.cartItemsArray.map(cartItem => ({
        id: cartItem.id,
        nombre: cartItem.nombre,
        descripcion: cartItem.descripcion,
        precio: cartItem.precio,
        cantidad: cartItem.cantidad,
      }));

      console.log('CarritoComponent: Preparando ítems para la reserva:', reservationItems);

      console.log('CarritoComponent: Guardando reserva...');
      const reservationId = await this.firebaseService.saveReservation(
        this.currentUserUid,
        formattedDate,
        reservationItems,
        this.totalCarrito
      );

      console.log('CarritoComponent: Limpiando carrito de Firebase después de la reserva exitosa...');
      await this.firebaseService.guardarCarritoUsuario(this.currentUserUid, {});
      this.cart = { items: {}, total: 0 };
      this.selectedReservationDate = null; // Clear the string value

      alert(`¡Reserva realizada con éxito! ID de la reserva: ${reservationId}. Puedes ver tus reservas en la Agenda.`);
      this.router.navigate(['/agenda']);
    } catch (error) {
      console.error('CarritoComponent: Error al procesar la reserva:', error);
      alert('Hubo un error al procesar tu reserva. Por favor, intenta de nuevo. Revisa la consola para más detalles.');
    }
  }
}
