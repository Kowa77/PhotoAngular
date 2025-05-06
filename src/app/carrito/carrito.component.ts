import { Component, OnInit, OnDestroy } from '@angular/core';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { AuthService } from '../auth/auth.service';
import { Servicio } from '../models/servicio.model';
import { Observable, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

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
  private readonly todosLosServicios = ['Civil', 'Exteriores', 'Fiesta', 'Getting Ready', 'Iglesia', 'Video de novios']; // Asegúrate de que coincida

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
     // Calcular el precio neto (sin IVA) dividiendo el total (con IVA) por 1.22
     const precioNeto = precioConDescuento / 1.22;
     // El IVA es la diferencia entre el precio con IVA y el precio neto
    this.iva = precioConDescuento - precioNeto;
    this.total = precioConDescuento; // El total ya incluye el IVA
  }

  estanTodosLosServiciosEnCarrito(): boolean {
    const nombresEnCarrito = this.carritoItems.map(item => item.nombre);
    return this.todosLosServicios.every(servicio => nombresEnCarrito.includes(servicio));
  }
}
