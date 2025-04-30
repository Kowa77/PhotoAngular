import { Component } from '@angular/core';
import { NavbarComponent } from '../../navbar/navbar.component'; // Importa NavbarComponent
import { CommonModule } from '@angular/common'; // Importa CommonModule si lo necesitas

@Component({
  selector: 'app-cumpleanos',
  imports: [NavbarComponent, CommonModule], // Añade NavbarComponent a los imports
  templateUrl: './cumpleanos.component.html',
  styleUrl: './cumpleanos.component.css'
})
export class CumpleanosComponent {

}
