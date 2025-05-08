import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Servicio } from '../models/servicio.model';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

// Declaración para evitar errores de tipo
declare global {
  interface Window {
    MercadoPago?: any;
  }
}

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pago.component.html',
  styleUrls: ['./pago.component.css']
})
export class PagoComponent implements OnInit, OnDestroy, AfterViewInit {
  carritoItems: Servicio[] = [];
  totalAPagar: number = 0;
  private userSubscription: Subscription | undefined;
  private userId: string | null = null;

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.userSubscription = this.authService.getAuthState().subscribe(user => {
      if (user) {
        this.userId = user.uid;
        this.loadCarritoItems();
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  ngAfterViewInit(): void {
    this.loadMercadoPagoSDK().then(() => {
      // Esperamos un breve momento adicional después de la carga
      setTimeout(() => {
        this.renderMercadoPagoButton();
      }, 100);
    }).catch(error => {
      console.error('Error al cargar el SDK de Mercado Pago:', error);
    });
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  loadCarritoItems(): void {
    if (this.userId) {
      this.firebaseService.obtenerCarritoUsuario(this.userId).pipe(take(1)).subscribe(carrito => {
        this.carritoItems = carrito?.servicios || [];
        this.calcularTotalAPagar();
      });
    }
  }

  calcularTotalAPagar(): void {
    this.totalAPagar = this.carritoItems.reduce((sum, item) => sum + item.precio, 0);
    const todosLosServicios = ['Civil', 'Exteriores', 'Fiesta', 'Getting Ready', 'Iglesia', 'Video de novios'];
    const descuentoAplicado = todosLosServicios.every(servicio => this.carritoItems.some(item => item.nombre === servicio));
    if (descuentoAplicado) {
      this.totalAPagar *= 0.9;
    }
  }

  private loadMercadoPagoSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window['MercadoPago'] && window['MercadoPago'].sdk) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      script.onload = () => {
        resolve();
      };
      script.onerror = (error) => {
        reject(error);
      };

      document.head.appendChild(script);
    });
  }

  renderMercadoPagoButton(): void {
    const mp = window['MercadoPago'];
    if (mp && mp.sdk) {
      mp.sdk.setPublicKey('APP_USR-06229710-166c-446a-8c99-71a433a926f0');
      const payment = mp.sdk.payment({
        amount: this.totalAPagar,
        // Puedes incluir más opciones aquí
      });
      payment.render('.cho-container');
    } else {
      console.error('MercadoPago SDK no se cargó correctamente.');
    }
  }
}
