import { Component, OnInit, OnDestroy } from '@angular/core';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { AuthService } from '../auth/auth.service';
import { Servicio } from '../models/servicio.model';
import { CarritoData } from '../models/carrito-data.model'; // Importa CarritoData desde la ubicación correcta
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
//import { RouterLink } from '@angular/router';

declare global {
  interface Window {
    MercadoPago: any;
    checkoutButton: any;
  }
}

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.css']
})
export class CarritoComponent implements OnInit, OnDestroy {
  carritoItems: Servicio[] = [];
  subtotal: number = 0;
  ivaPorcentaje: number = 0.22;
  iva: number = 0;
  total: number = 0;
  descuentoAplicado: boolean = false;
  private userSubscription: Subscription | undefined;
  private userId: string | null = null;
  private readonly todosLosServicios = ['Civil', 'Exteriores', 'Fiesta', 'Getting Ready', 'Iglesia', 'Video de novios'];
  private mp: any;

  constructor(private firebaseService: FirebaseService, private authService: AuthService) { }

  ngOnInit(): void {
    this.userSubscription = this.authService.getAuthState().subscribe(user => {
      if (user) {
        this.userId = user.uid;
        this.loadCarritoItems();
      } else {
        this.userId = null;
        this.carritoItems = [];
        this.calcularTotales();
      }
    });

    // Inicializa Mercado Pago al cargar el componente
    this.mp = new window.MercadoPago("APP_USR-31042028-7376-4288-94b4-edd6a94f77c1", {
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

  loadCarritoItems(): void {
    if (this.userId) {
      this.firebaseService.obtenerCarritoUsuario(this.userId).pipe(take(1)).subscribe((carrito: CarritoData | null) => {
        this.carritoItems = carrito?.servicios || [];
        this.calcularTotales();
      });
    }
  }

  eliminarDelCarrito(servicio: Servicio): void {
    if (this.userId) {
      this.carritoItems = this.carritoItems.filter(item => item.key !== servicio.key);
      this.firebaseService.guardarCarritoUsuario(this.userId, { servicios: this.carritoItems }).then(() => {
        this.calcularTotales();
      });
    }
  }

  calcularTotales(): void {
    this.subtotal = this.carritoItems.reduce((sum, item) => sum + item.precio, 0);
    this.descuentoAplicado = this.estanTodosLosServiciosEnCarrito();
    let precioConDescuento = this.subtotal;
    if (this.descuentoAplicado) {
      precioConDescuento *= 0.9;
    }
    const precioNeto = precioConDescuento / 1.22;
    this.iva = precioConDescuento - precioNeto;
    this.total = precioConDescuento;
  }

  estanTodosLosServiciosEnCarrito(): boolean {
    const nombresEnCarrito = this.carritoItems.map(item => item.nombre);
    return this.todosLosServicios.every(servicio => nombresEnCarrito.includes(servicio));
  }

  async iniciarCheckout(): Promise<void> {
    try {
      // Adaptar orderData para que refleje el carrito actual
      const orderData = {
        title: "Servicios Contratados", // Puedes hacerlo más descriptivo
        quantity: 1, // Considera cómo manejar múltiples items
        price: this.total // Usar el total calculado
      };

      const response = await fetch("https://servidor-js-mp-production.up.railway.app/create_preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderData)
      });

      const preference = await response.json();
      console.log(preference);
      this.createCheckoutButton(preference.id);

    } catch (error) {
      alert("Error al crear la preferencia de pago");
      console.error(error);
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
}
