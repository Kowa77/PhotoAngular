import { Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { Servicio } from '../models/servicio.model';
import { Auth, user } from '@angular/fire/auth';
import { take } from 'rxjs/operators';
import { Router } from '@angular/router'; // Importa el Router

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
  descuentoAplicadoBoton: boolean = false;
  private readonly todosLosServicios = ['Civil', 'Exteriores', 'Fiesta', 'Getting Ready', 'Iglesia', 'Video de novios']; // Asegúrate de que coincida

  @ViewChildren('servicioCheckbox') servicioCheckboxes!: QueryList<any>;

  constructor(
    private firebaseService: FirebaseService,
    private auth: Auth,
    private router: Router // Inyecta el Router
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
            this.marcarCheckboxesGuardados();
            this.descuentoAplicadoBoton = this.estanTodosLosServiciosSeleccionados(); // Actualizar estado del botón
          } else {
            this.serviciosSeleccionados = [];
            this.recalcularTotalYDescuento();
            this.descuentoAplicadoBoton = false; // Habilitar el botón
          }
        });
      } else {
        this.serviciosSeleccionados = [];
        this.recalcularTotalYDescuento();
        this.descuentoAplicadoBoton = false; // Habilitar el botón
      }
    });
  }

  marcarCheckboxesGuardados(): void {
    this.servicios$.pipe(take(1)).subscribe(servicios => {
      this.servicioCheckboxes.forEach(checkbox => {
        const servicioAsociado = servicios.find(s => s.key === checkbox.nativeElement.value);
        if (servicioAsociado && this.serviciosSeleccionados.some(s => s.key === servicioAsociado.key)) {
          checkbox.nativeElement.checked = true;
        }
      });
    });
  }

  onCheckboxChange(servicio: Servicio, target: EventTarget | null): void {
    if (target instanceof HTMLInputElement) {
      if (target.checked) {
        this.serviciosSeleccionados = [...this.serviciosSeleccionados, servicio];
      } else {
        this.serviciosSeleccionados = this.serviciosSeleccionados.filter(s => s.key !== servicio.key);
      }
      this.recalcularTotalYDescuento();
      this.descuentoAplicadoBoton = this.estanTodosLosServiciosSeleccionados(); // Actualizar estado del botón
    }
  }

  aplicarDescuentoManual(): void {
    if (!this.descuentoAplicadoBoton) {
      this.servicios$.pipe(take(1)).subscribe(servicios => {
        this.serviciosSeleccionados = [...servicios]; // Seleccionar todos los servicios
        this.recalcularTotalYDescuento();
        this.servicioCheckboxes.forEach(checkbox => {
          checkbox.nativeElement.checked = true; // Marcar todos los checkboxes
        });
        this.descuentoAplicadoBoton = true; // Deshabilitar el botón
      });
    } else {
      this.serviciosSeleccionados = []; // Deseleccionar todos los servicios
      this.recalcularTotalYDescuento();
      this.servicioCheckboxes.forEach(checkbox => {
        checkbox.nativeElement.checked = false; // Desmarcar todos los checkboxes
      });
      this.descuentoAplicadoBoton = false; // Habilitar el botón
    }
  }

  private estanTodosLosServiciosSeleccionados(): boolean {
    return this.todosLosServicios.length === this.serviciosSeleccionados.length;
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
        this.router.navigate(['/carrito']); // Redirige a la página del carrito
      }
    });
  }
}
