import { Component, OnInit } from '@angular/core';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { Servicio } from './../models/servicio.model';
import { Auth, user } from '@angular/fire/auth';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-servicios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.css']
})
export class ServiciosComponent implements OnInit {
  servicios$: Observable<Servicio[]> = of([]);
  totalPrecio: number = 0;
  serviciosSeleccionados: Servicio[] = [];
  user$: Observable<any>;
  descuentoAplicado: boolean = false;
  private readonly todosLosServicios = ['Civil', 'Exteriores', 'Fiesta', 'Getting Ready', 'Iglesia', 'Video de novios'];

  constructor(
    private firebaseService: FirebaseService,
    private auth: Auth
  ) {
    this.user$ = user(this.auth);
  }

  ngOnInit(): void {
    this.servicios$ = this.firebaseService.getServicios();
    this.cargarCarritoGuardado();
  }

  async cargarCarritoGuardado(): Promise<void> {
    this.user$.pipe(take(1)).subscribe(async (currentUser) => {
      if (currentUser) {
        const uid = currentUser.uid;
        this.firebaseService.obtenerCarritoUsuario(uid).pipe(take(1)).subscribe(carritoGuardado => {
          if (carritoGuardado && carritoGuardado.servicios) {
            this.serviciosSeleccionados = carritoGuardado.servicios;
            this.recalcularTotalYDescuento();
          } else {
            this.serviciosSeleccionados = [];
            this.recalcularTotalYDescuento();
          }
        });
      } else {
        this.serviciosSeleccionados = [];
        this.recalcularTotalYDescuento();
      }
    });
  }

  onCheckboxChange(servicio: Servicio, target: EventTarget | null): void {
    if (target instanceof HTMLInputElement) {
      if (target.checked) {
        this.serviciosSeleccionados = [...this.serviciosSeleccionados, servicio];
      } else {
        this.serviciosSeleccionados = this.serviciosSeleccionados.filter(s => s.nombre !== servicio.nombre);
      }
      this.recalcularTotalYDescuento();
    }
  }

  aplicarDescuentoManual(): void {
    if (this.estanTodosLosServiciosSeleccionados()) {
      this.aplicarDescuento();
    } else {
      this.removerDescuento();
    }
  }

  private estanTodosLosServiciosSeleccionados(): boolean {
    const nombresSeleccionados = this.serviciosSeleccionados.map(s => s.nombre);
    return this.todosLosServicios.every(servicio => nombresSeleccionados.includes(servicio));
  }

  private recalcularTotalYDescuento(): void {
    this.totalPrecio = this.serviciosSeleccionados.reduce((sum, servicio) => sum + servicio.precio, 0);
    if (this.estanTodosLosServiciosSeleccionados()) {
      this.aplicarDescuento();
    } else {
      this.removerDescuento();
    }
  }

  private aplicarDescuento(): void {
    if (!this.descuentoAplicado) {
      this.totalPrecio *= 0.9;
      this.descuentoAplicado = true;
      console.log('¡Descuento del 10% aplicado!');
    }
  }

  private removerDescuento(): void {
    if (this.descuentoAplicado) {
      this.totalPrecio = this.serviciosSeleccionados.reduce((sum, servicio) => sum + servicio.precio, 0);
      this.descuentoAplicado = false;
      console.log('Descuento removido.');
    }
  }

  async guardarCarritoEnFirebase(): Promise<void> {
    this.user$.pipe(take(1)).subscribe(async (currentUser) => {
      if (currentUser) {
        const uid = currentUser.uid;
        const carrito = { servicios: this.serviciosSeleccionados };
        await this.firebaseService.guardarCarritoUsuario(uid, carrito);
        console.log('Carrito guardado para el usuario:', uid);
      }
    });
  }
}
