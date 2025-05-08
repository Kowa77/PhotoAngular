import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Servicio } from '../models/servicio.model';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { VexorPayComponent } from '../vexor-pay/vexor-pay.component';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, RouterLink, VexorPayComponent],
  templateUrl: './pago.component.html',
  styleUrls: ['./pago.component.css']
})
export class PagoComponent implements OnInit, OnDestroy {
  carritoItems: Servicio[] = [];
  totalAPagar: number = 0;
  private userSubscription: Subscription | undefined;
  private userId: string | null = null;
  paymentItemsForVexor: any[] = []; // Nueva propiedad para los items formateados

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService,
    private router: Router,
    private http: HttpClient
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
        this.paymentItemsForVexor = this.carritoItems.map(item => ({
          title: item.nombre,
          description: item.nombre,
          quantity: 1,
          unit_price: item.precio
        }));
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
}
