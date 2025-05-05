import { Component, OnInit } from '@angular/core';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { Servicio } from './../models/servicio.model';
import { Auth, user } from '@angular/fire/auth';
import { take } from 'rxjs/operators';
import { AngularFireModule } from '@angular/fire/compat'; // Importa AngularFireModule
import { environment } from '../../environments/environment'; // Asegúrate de la ruta correcta

@Component({
  selector: 'app-servicios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.css'],
  providers: [
    {
      provide: 'angularfire2.app.options',
      useValue: environment.firebase
    },
    // AngularFireModule // No importes el módulo aquí, solo la configuración
  ]
})
export class ServiciosComponent implements OnInit {
  servicios$: Observable<Servicio[]> = of([]);
  totalPrecio: number = 0;
  serviciosSeleccionados: Servicio[] = [];
  user$: Observable<any>; // Declaración sin inicializar

  constructor(
    private firebaseService: FirebaseService,
    private auth: Auth
  ) {
    this.user$ = user(this.auth); // Inicialización en el constructor
  }

  ngOnInit(): void {
    this.servicios$ = this.firebaseService.getServicios();
    this.cargarCarritoGuardado(); // Cargar el carrito guardado al inicio
  }

  async cargarCarritoGuardado(): Promise<void> {
    this.user$.pipe(take(1)).subscribe(async (currentUser) => {
      if (currentUser) {
        const uid = currentUser.uid;
        this.firebaseService.obtenerCarritoUsuario(uid).pipe(take(1)).subscribe(carritoGuardado => {
          if (carritoGuardado && carritoGuardado.servicios) {
            this.serviciosSeleccionados = carritoGuardado.servicios;
            this.totalPrecio = this.serviciosSeleccionados.reduce((sum, servicio) => sum + servicio.precio, 0);
            // Aquí podrías marcar los checkboxes correspondientes en la UI si es necesario
          }
        });
      }
    });
  }

  async onCheckboxChange(servicio: Servicio, target: EventTarget | null): Promise<void> {
    if (target instanceof HTMLInputElement) {
      if (target.checked) {
        this.totalPrecio += servicio.precio;
        this.serviciosSeleccionados = [...this.serviciosSeleccionados, servicio];
      } else {
        this.totalPrecio -= servicio.precio;
        this.serviciosSeleccionados = this.serviciosSeleccionados.filter(s => s.nombre !== servicio.nombre);
      }
      await this.guardarCarritoEnFirebase(); // Guardar el carrito después de cada cambio
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
