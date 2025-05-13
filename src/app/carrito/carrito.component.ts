import { Component, OnInit, OnDestroy } from '@angular/core';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { AuthService } from '../auth/auth.service';
import { Servicio } from '../models/servicio.model';
import { CarritoData } from '../models/carrito-data.model';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
//import { RouterLink } from '@angular/router'; // No lo estás usando, lo dejo comentado

declare global {
  interface Window {
    MercadoPago: any;
    checkoutButton: any;
  }
}

interface HandyCart {
  Currency: number;
  TotalAmount: number;
  TaxedAmount: number;
  Products: HandyProduct[];
  InvoiceNumber: number;
  LinkImageUrl: string;
  TransactionExternalId: string;
}

interface HandyProduct {
  Name: string;
  Quantity: number;
  Amount: number;
  TaxedAmount: number;
}

interface HandyClient {
  CommerceName: string;
  SiteUrl: string;
}

interface HandyPaymentRequest {
  Cart: HandyCart;
  Client: HandyClient;
  CallbackURL: string;
  ResponseType: 'Json' | 'HttpRedirect';
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
  handyMerchantSecret: string = 'cb1668e9-cb22-41ad-99d2-1c0e6e5deb8c';
  handyApiUrl: string = 'https://api.payments.arriba.uy/api/payments';

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

  async iniciarCheckoutHandy(): Promise<void> {
    if (!this.userId) {
      alert('Debes estar logueado para iniciar el pago.');
      return;
    }

    const handyCart: HandyCart = {
      Currency: 858,
      TotalAmount: this.total,
      TaxedAmount: this.total / 1.22,
      Products: this.carritoItems.map(item => ({
        Name: item.nombre,
        Quantity: 1,
        Amount: item.precio,
        TaxedAmount: item.precio / 1.22
      })),
      InvoiceNumber: 123456,
      LinkImageUrl: 'https://www.example.com/imagen-carrito.jpg',
      TransactionExternalId: this.userId + '-' + Date.now().toString()
    };

    const handyClient: HandyClient = {
      CommerceName: 'Tu Comercio',
      SiteUrl: 'https://www.tudominio.com'
    };

    const handyPaymentRequest: HandyPaymentRequest = {
      Cart: handyCart,
      Client: handyClient,
      CallbackURL: 'https://tu-servidor.com/callback-handy',
      ResponseType: 'HttpRedirect'
    };

    try {
      const response = await fetch(this.handyApiUrl, {
        method: 'POST',
        headers: {
          'merchant-secret-key': this.handyMerchantSecret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(handyPaymentRequest)
      });

      if (!response.ok) {
        throw new Error(`Error al iniciar el pago: ${response.status} ${response.statusText}`);
      }

      if (handyPaymentRequest.ResponseType === 'Json') {
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No se recibió la URL de pago de Handy.');
        }
      }
    } catch (error: any) {
      alert(`Error al iniciar el pago con Handy: ${error.message}`);
      console.error('Error al iniciar el pago con Handy:', error);
    }
  }

  async iniciarCheckout(): Promise<void> {
    try {
      const orderData = {
        title: "Servicios Contratados",
        quantity: 1,
        price: this.total
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

