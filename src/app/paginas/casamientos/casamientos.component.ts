import { Component } from '@angular/core';
import { NavbarComponent } from '../../navbar/navbar.component'; // Importa NavbarComponent
import { CommonModule } from '@angular/common'; // Importa CommonModule si lo necesitas

@Component({
  selector: 'app-casamientos',
  imports: [NavbarComponent, CommonModule], // Agrega NavbarComponent aquí
  templateUrl: './casamientos.component.html',
  styleUrl: './casamientos.component.css'
})
export class CasamientosComponent {

}
