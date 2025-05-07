import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Servicio } from '../models/servicio.model';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pago.component.html',
  styleUrls: ['./pago.component.css']
})
export class PagoComponent implements OnInit, OnDestroy {
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
        this.renderMercadoPagoButton();
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

  initMercadoPago(): void {
    if ((window as any).MercadoPago && (window as any).MercadoPago.sdk) {
      console.log('MercadoPago SDK disponible (inicialización directa).');
      (window as any).MercadoPago.sdk.setPublicKey('TU_CLAVE_PUBLICA');

      const checkout = (window as any).MercadoPago.sdk.checkout({
        preference: {
          items: this.carritoItems.map(item => ({
            title: item.nombre,
            quantity: 1,
            unit_price: this.totalAPagar
          })),
        },
        render: {
          container: '.cho-container',
          label: 'Pagar con Mercado Pago',
        }
      });
    } else {
      console.warn('MercadoPago SDK aún no está disponible, intentando de nuevo en 500ms...');
      setTimeout(() => this.initMercadoPago(), 500);
    }
  }

  renderMercadoPagoButton(): void {
    // Esta función ya no necesita crear el script, solo llama a initMercadoPago
    this.initMercadoPago();
  }


}
