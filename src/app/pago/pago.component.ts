import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Servicio } from '../models/servicio.model';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule],
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
        this.router.navigate(['/']); // Redirigir si no hay usuario logueado
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
    // El total ya incluye el IVA en nuestra lógica anterior
  }

  renderMercadoPagoButton(): void {
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    document.body.appendChild(script);

    script.onload = () => {
      (window as any).MercadoPago.sdk.setPublicKey('YOUR_MERCADOPAGO_PUBLIC_KEY'); // Reemplaza con tu clave pública

      const checkout = (window as any).MercadoPago.sdk.checkout({
        preference: {
          items: this.carritoItems.map(item => ({
            title: item.nombre,
            quantity: 1,
            unit_price: this.totalAPagar // Usamos el total calculado con descuento e IVA
          })),
          // Puedes agregar más detalles como el comprador, redirecciones, etc.
        },
        render: {
          container: '.cho-container', // Clase donde se renderizará el botón
          label: 'Pagar con Mercado Pago', // Texto del botón
        }
      });
    };
  }
}
