import { Component } from '@angular/core';
import { NavbarComponent } from '../../navbar/navbar.component'; // Importa NavbarComponent
import { CommonModule } from '@angular/common'; // Importa CommonModule si lo necesitas

@Component({
  selector: 'app-extras',
  imports: [NavbarComponent, CommonModule], // Agrega NavbarComponent aquí
  templateUrl: './extras.component.html',
  styleUrl: './extras.component.css'
})
export class ExtrasComponent {

}
