import { Component } from '@angular/core';
//import { NavbarComponent } from '../../navbar/navbar.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cumpleanos',
  //imports: [NavbarComponent, CommonModule],
  imports: [CommonModule],
  templateUrl: './cumpleanos.component.html',
  styleUrl: './cumpleanos.component.css'
})
export class CumpleanosComponent {
  isDecoracionDetailsVisible: boolean = false;
  isFotoVideoDetailsVisible: boolean = false;

  toggleDetails(elementId: string) {
    if (elementId === 'decoracionDetails') {
      this.isDecoracionDetailsVisible = !this.isDecoracionDetailsVisible;
      this.scrollToDetails(elementId);
    } else if (elementId === 'fotoVideoDetails') {
      this.isFotoVideoDetailsVisible = !this.isFotoVideoDetailsVisible;
      this.scrollToDetails(elementId);
    }
  }

  getButtonText(elementId: string): string {
    if (elementId === 'decoracionDetails') {
      return this.isDecoracionDetailsVisible ? 'Ocultar detalles' : 'Ver detalles';
    } else if (elementId === 'fotoVideoDetails') {
      return this.isFotoVideoDetailsVisible ? 'Ocultar detalles de Foto y Video' : 'Ver detalles de Foto y Video';
    }
    return 'Ver detalles';
  }

  scrollToDetails(elementId: string) {
    const element = document.getElementById(elementId);
    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }
}
