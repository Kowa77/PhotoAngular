// src/app/carrito/carrito.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { AuthService } from '../auth/auth.service';
import { Servicio } from '../models/servicio.model';
// Importa CarritoData desde tu FirebaseService, ya que ahí la definimos para Realtime DB
import { CarritoData } from '../firebase/firefirebase-service.service';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http'; // Importa HttpClient

// Importaciones de Angular Material y Forms
import { FormsModule } from '@angular/forms'; // Necesario para [(ngModel)]
import { MatFormFieldModule } from '@angular/material/form-field'; // Para <mat-form-field>
import { MatInputModule } from '@angular/material/input';       // Para matInput
import { MatDatepickerModule } from '@angular/material/datepicker'; // Para <mat-datepicker> y [matDatepicker]
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core'; // Para MatDatepicker (locale)
import { MatDatepickerInputEvent } from '@angular/material/datepicker'; // Para el evento dateChange
import { RouterLink } from '@angular/router'; // Para el routerLink en el HTML

declare global {
  interface Window {
    MercadoPago: any;
    checkoutButton: any;
  }
}

@Component({
  selector: 'app-carrito',
  standalone: true,
  // Asegúrate de que todas estas importaciones estén aquí
  imports: [
    CommonModule,
    FormsModule, // Necesario para [(ngModel)]
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule, // O MatMomentDateModule, si usas moment.js
    RouterLink // Para el routerLink en el HTML
  ],
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.css'],
  providers: [
    // Opcional: Configura el locale para el datepicker
    { provide: MAT_DATE_LOCALE, useValue: 'es-UY' } // O 'es-ES', etc.
  ]
})
export class CarritoComponent implements OnInit, OnDestroy {
  carritoItems: Servicio[] = []; // Esta es la lista "hidratada" de servicios con su cantidad, para el UI
  subtotal: number = 0;
  ivaPorcentaje: number = 0.22;
  iva: number = 0;
  total: number = 0;
  descuentoAplicado: boolean = false;
  private userSubscription: Subscription | undefined;
  public userId: string | null = null;
  // Esta lista de nombres es para la lógica del descuento, no para cargar servicios
  private readonly todosLosServiciosConDescuento = ['Civil', 'Exteriores', 'Fiesta', 'Getting Ready', 'Iglesia', 'Video de novios'];
  private mp: any;

  selectedReservationDate: Date | null = null;
  minDate: Date;
  maxDate: Date;
  dateFilter = (d: Date | null): boolean => {
    const day = (d || new Date()).getDay();
    // Previene que los domingos (0) y sábados (6) sean seleccionados
    return day !== 0 && day !== 6;
  };
  dateClass = (d: Date) => {
    return ''; // Por ahora, no aplica ninguna clase CSS especial
  };

  // --- Crucial para mapear IDs del carrito a objetos Servicio completos ---
  allServices: Servicio[] = []; // Aquí se cargarán todos los servicios base disponibles

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.minDate = new Date(); // La fecha mínima es hoy
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 1); // La fecha máxima es un año a partir de hoy
  }

  ngOnInit(): void {
    this.userSubscription = this.authService.getAuthState().subscribe(user => {
      if (user) {
        this.userId = user.uid;
        // ¡IMPORTANTE! Primero cargamos la lista completa de servicios desde Firebase,
        // y solo DESPUÉS cargamos el carrito del usuario.
        this.cargarTodosLosServiciosDisponibles().then(() => {
          this.loadCarritoItems();
        }).catch(error => {
          console.error('Error al cargar todos los servicios o el carrito:', error);
          // Aquí podrías mostrar un mensaje al usuario
        });
      } else {
        this.userId = null;
        this.carritoItems = [];
        this.calcularTotales();
      }
    });

    // Inicialización del SDK de Mercado Pago
    this.mp = new window.MercadoPago("APP_USR-631ae831-3bfa-4245-a0fa-68d77daba0e2", {
      locale: "es-UY"
    });
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (window.checkoutButton) {
      window.checkoutButton.unmount();
    }
  }

  // --- ¡ESTA ES LA FUNCIÓN CLAVE MODIFICADA PARA CARGAR SERVICIOS REALES DE FIREBASE! ---
  async cargarTodosLosServiciosDisponibles(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Usamos el método getServicios() de tu FirebaseService para obtener todos los servicios
      this.firebaseService.getServicios().pipe(take(1)).subscribe({
        next: (servicios) => {
          this.allServices = servicios;
          console.log('Todos los servicios disponibles cargados (de Firebase):', this.allServices);
          resolve(); // Resuelve la promesa una vez que los servicios están cargados
        },
        error: (error) => {
          console.error('Error al cargar todos los servicios disponibles desde Firebase:', error);
          reject(error); // Rechaza la promesa si hay un error
        }
      });
    });
  }

  // --- MODIFICADA: Convierte CarritoData (mapa de IDs a cantidades) a Servicio[] ---
  loadCarritoItems(): void {
    if (this.userId && this.allServices.length > 0) { // Solo si userId existe y allServices ya está cargado
      this.firebaseService.obtenerCarritoUsuario(this.userId).pipe(take(1)).subscribe((carritoMap: CarritoData) => {
        const loadedCarritoItems: Servicio[] = [];
        // Itera sobre el mapa del carrito { serviceId: cantidad }
        for (const serviceId in carritoMap) {
          if (carritoMap.hasOwnProperty(serviceId)) {
            const cantidad = carritoMap[serviceId];
            // Busca el servicio completo en la lista de todos los servicios disponibles
            const servicioBase = this.allServices.find(s => s.id === serviceId);

            if (servicioBase && cantidad > 0) {
              // Si el servicio existe y tiene cantidad, lo agregamos al carritoItems
              loadedCarritoItems.push({
                ...servicioBase, // Copia todas las propiedades del servicio base
                cantidad: cantidad // Añade la cantidad específica de este carrito
              });
            }
          }
        }
        this.carritoItems = loadedCarritoItems;
        console.log('Carrito "hidratado" cargado (Servicio[]):', this.carritoItems);
        this.calcularTotales();
      }, error => {
        console.error('Error al obtener el carrito del usuario:', error);
        this.carritoItems = [];
        this.calcularTotales();
      });
    } else if (this.userId && this.allServices.length === 0) {
      console.warn('CarritoComponent: Intentando cargar carrito sin que "allServices" esté disponible. Esto puede causar un error de visualización.');
    }
  }

  // --- MODIFICADA: Convierte Servicio[] a CarritoData para guardar en Firebase ---
  eliminarDelCarrito(servicio: Servicio): void {
    if (this.userId) {
      // Filtra el servicio eliminado del array local
      this.carritoItems = this.carritoItems.filter(item => item.id !== servicio.id);

      // Convierte el array local de Servicio[] de nuevo a un mapa { serviceId: cantidad } para guardar en Realtime DB
      const carritoMapToSave: CarritoData = {};
      this.carritoItems.forEach(item => {
        carritoMapToSave[item.id] = item.cantidad;
      });

      this.firebaseService.guardarCarritoUsuario(this.userId, carritoMapToSave).then(() => {
        console.log('Carrito actualizado en Realtime DB:', carritoMapToSave);
        this.calcularTotales();
      }).catch(error => {
        console.error('Error al guardar el carrito en Realtime DB:', error);
      });
    }
  }

  // MODIFICADA: Calcula el subtotal multiplicando precio por cantidad
  calcularTotales(): void {
    this.subtotal = this.carritoItems.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    this.descuentoAplicado = this.estanTodosLosServiciosEnCarrito();
    let precioConDescuento = this.subtotal;
    if (this.descuentoAplicado) {
      precioConDescuento *= 0.9; // Aplica el 10% de descuento
    }
    const precioNeto = precioConDescuento / (1 + this.ivaPorcentaje); // Recalcula precio neto considerando el IVA
    this.iva = precioConDescuento - precioNeto;
    this.total = precioConDescuento;
  }

  estanTodosLosServiciosEnCarrito(): boolean {
    // Usa la lista para el descuento que definiste
    const nombresEnCarrito = this.carritoItems.map(item => item.nombre);
    return this.todosLosServiciosConDescuento.every(servicio => nombresEnCarrito.includes(servicio));
  }

  async iniciarCheckout(): Promise<void> {
    try {
      if (!this.selectedReservationDate) {
        alert("Por favor, selecciona una fecha de reserva antes de proceder al pago.");
        return;
      }

      // Prepara los ítems para Mercado Pago. Si tu backend PHP espera un solo ítem con el total, esto es correcto.
      // Si espera una lista de ítems detallados del carrito, necesitarías ajustar esto.
      const orderData = {
        title: "Servicios Contratados", // Podría ser "Servicios de Fotografía y Video"
        quantity: 1, // Si solo envías el total del carrito como un único "producto"
        price: this.total, // El precio total del carrito
        reservationDate: this.selectedReservationDate.toISOString()
      };
      // Aquí puedes añadir userId si tu backend lo necesita para guardar la orden
      if (this.userId) {
        // orderData.userId = this.userId; // Descomenta si necesitas enviar el userId
      }

      // URL de tu servidor PHP. Ajusta el '/create_preference' si tu ruta es diferente.
//       const response = await fetch("http://https://sporting-mia-kowa77-f503b438.koyeb.app/create_preference", { // <--- ¡VERIFICA ESTA URL CON TU BACKEND PHP!
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify(orderData)
//       });
      const response = await fetch("https://backend-foto-kowa77-f503b438.koyeb.app/create_preference", {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Error en el servidor PHP: ${response.status} - ${JSON.stringify(errorBody)}`);
      }

      const preference = await response.json();
      console.log('Preferencia de Mercado Pago recibida:', preference);
      this.createCheckoutButton(preference.id);

    } catch (error) {
      alert("Error al crear la preferencia de pago. Por favor, inténtalo de nuevo.");
      console.error("Detalle del error al iniciar checkout:", error);
    }
  }

  createCheckoutButton(preferenceId: string): void {
    const bricksBuilder = this.mp.bricks();

    const renderComponent = async () => {
      if (window.checkoutButton) {
        window.checkoutButton.unmount();
      }

      try {
        window.checkoutButton = await bricksBuilder.create("wallet", "wallet_container", {
          initialization: {
            preferenceId: preferenceId
          },
          customization: {
            visual: {
              theme: "dark",
              color: "#000000",
              logo: "https://www.mercadopago.com.uy/fp/checkout/checkout.png"
            }
          },
          callbacks: {
            onReady: () => {
              console.log("Bricks initialized");
            },
            onError: (error: any) => {
              console.error("Error initializing bricks", error);
            }
          }
        });
        console.log("Bricks rendered");
      } catch (e) {
        console.error("Error creating Wallet Brick", e);
      }
    };
    renderComponent();
  }

  onDateSelect(event: MatDatepickerInputEvent<Date>): void {
    this.selectedReservationDate = event.value;
    console.log('Fecha seleccionada:', this.selectedReservationDate);
  }

  // --- trackBy para el nuevo `@for` (recibe solo el item) ---
  trackByItemId(item: Servicio): string {
    return item.id; // Retorna el ID único del servicio
  }
}
