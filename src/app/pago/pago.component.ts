import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
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
    this.renderMercadoPagoButton();
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

  renderMercadoPagoButton(): void {
    if ((window as any).MercadoPago && (window as any).MercadoPago.sdk) {
      (window as any).MercadoPago.sdk.setPublicKey('APP_USR-06229710-166c-446a-8c99-71a433a926f0');

      const payment = (window as any).MercadoPago.sdk.payment({
        amount: this.totalAPagar,
        // Puedes incluir más opciones aquí, como el ID de la preferencia si la tienes
        // notification_url: 'TU_URL_DE_NOTIFICACION',
        // external_reference: 'TU_REFERENCIA_EXTERNA',
      });
      payment.render('.cho-container');
    } else {
      console.warn('MercadoPago SDK aún no está disponible.');
    }
  }
}
