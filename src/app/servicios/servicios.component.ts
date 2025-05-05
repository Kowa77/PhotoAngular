import { Component, OnInit } from '@angular/core';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs'; // Importa 'of'
import { Servicio } from './../models/servicio.model'; // Importa la interfaz

@Component({
  selector: 'app-servicios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.css']
})
export class ServiciosComponent implements OnInit {
  servicios$: Observable<Servicio[]> = of([]); // Inicializamos con un Observable de un array vacío
  totalPrecio: number = 0;

  constructor(private firebaseService: FirebaseService) { }

  ngOnInit(): void {
    this.servicios$ = this.firebaseService.getServicios();
  }

  onCheckboxChange(servicio: Servicio, target: EventTarget | null): void {
    if (target instanceof HTMLInputElement) {
      if (target.checked) {
        this.totalPrecio += servicio.precio;
      } else {
        this.totalPrecio -= servicio.precio;
      }
    }
  }

}
