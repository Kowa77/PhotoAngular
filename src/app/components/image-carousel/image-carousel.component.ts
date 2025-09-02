import { Component, Input, OnInit, OnDestroy, HostListener, signal, Output, EventEmitter, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-carousel.component.html',
  styleUrls: ['./image-carousel.component.css']
})
export class ImageCarouselComponent implements OnChanges, OnDestroy {
  @Input() images: string[] = [];
  @Input() initialIndex: number = 0; // Nuevo input para el índice inicial
  @Output() imageChanged = new EventEmitter<number>(); // Emite el índice de la imagen actual

  currentIndex = signal<number>(0);

  // Escucha eventos del teclado en todo el documento
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      this.prevImage();
    } else if (event.key === 'ArrowRight') {
      this.nextImage();
    }
  }

  // Hook del ciclo de vida para detectar cambios en los inputs
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialIndex'] && changes['initialIndex'].currentValue !== this.currentIndex()) {
      this.currentIndex.set(changes['initialIndex'].currentValue);
      this.imageChanged.emit(this.currentIndex());
    }
  }

  ngOnDestroy(): void {}

  // Muestra la imagen anterior
  prevImage(): void {
    if (this.images.length === 0) return;
    const newIndex = this.currentIndex() === 0 ? this.images.length - 1 : this.currentIndex() - 1;
    this.currentIndex.set(newIndex);
    this.imageChanged.emit(newIndex);
  }

  // Muestra la siguiente imagen
  nextImage(): void {
    if (this.images.length === 0) return;
    const newIndex = this.currentIndex() === this.images.length - 1 ? 0 : this.currentIndex() + 1;
    this.currentIndex.set(newIndex);
    this.imageChanged.emit(newIndex);
  }

  // Navega a una imagen específica por su índice
  goToImage(index: number): void {
    if (index >= 0 && index < this.images.length) {
      this.currentIndex.set(index);
      this.imageChanged.emit(index);
    }
  }
}
