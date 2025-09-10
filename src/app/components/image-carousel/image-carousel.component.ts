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
  @Input() initialIndex: number = 0;
  @Output() imageChanged = new EventEmitter<number>();
  @Output() deletePhotoRequest = new EventEmitter<void>();

  currentIndex = signal<number>(0);
  showZoomOverlay = signal<boolean>(false);

  // --- Variables para el zoom interactivo ---
  scale = signal<number>(1);
  translateX = signal<number>(0);
  translateY = signal<number>(0);
  isDragging = signal<boolean>(false);
  startX = signal<number>(0);
  startY = signal<number>(0);

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.showZoomOverlay()) {
      if (event.key === 'Escape') {
        this.closeZoom();
      }
    } else {
      if (event.key === 'ArrowLeft') {
        this.prevImage();
      } else if (event.key === 'ArrowRight') {
        this.nextImage();
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialIndex'] && changes['initialIndex'].currentValue !== this.currentIndex()) {
      this.currentIndex.set(changes['initialIndex'].currentValue);
      this.imageChanged.emit(this.currentIndex());
    }
  }

  ngOnDestroy(): void {}

  prevImage(): void {
    if (this.images.length === 0) return;
    const newIndex = this.currentIndex() === 0 ? this.images.length - 1 : this.currentIndex() - 1;
    this.currentIndex.set(newIndex);
    this.imageChanged.emit(newIndex);
  }

  nextImage(): void {
    if (this.images.length === 0) return;
    const newIndex = this.currentIndex() === this.images.length - 1 ? 0 : this.currentIndex() + 1;
    this.currentIndex.set(newIndex);
    this.imageChanged.emit(newIndex);
  }

  goToImage(index: number): void {
    if (index >= 0 && index < this.images.length) {
      this.currentIndex.set(index);
      this.imageChanged.emit(index);
    }
  }

  // ✅ Descargar en máxima calidad
  downloadImage(): void {
    const imageUrl = this.images[this.currentIndex()];
    if (!imageUrl) {
      console.warn('No hay imagen para descargar.');
      return;
    }

    // Forzar descarga en máxima resolución
    const url = imageUrl + '=d';

    const link = document.createElement('a');
    link.href = url;

    // Nombre de archivo
    const parts = imageUrl.split('/');
    const filename = parts[parts.length - 1].split('?')[0] || 'imagen_descarga.jpg';
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  openZoom(): void {
    this.showZoomOverlay.set(true);
    document.body.style.overflow = 'hidden';
    // Resetear el estado del zoom al abrir
    this.scale.set(1);
    this.translateX.set(0);
    this.translateY.set(0);
  }

  closeZoom(): void {
    this.showZoomOverlay.set(false);
    document.body.style.overflow = 'auto';
  }

  // --- Métodos para el zoom interactivo ---
  onWheelZoom(event: WheelEvent): void {
    event.preventDefault();

    const delta = event.deltaY * -0.01;
    const newScale = this.scale() + delta;

    if (newScale >= 0.5 && newScale <= 5) {
      this.scale.set(newScale);
    }
  }

  onMouseDown(event: MouseEvent): void {
    if (this.scale() > 1) {
      this.isDragging.set(true);
      this.startX.set(event.clientX - this.translateX());
      this.startY.set(event.clientY - this.translateY());
    }
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging()) return;
    event.preventDefault();
    const newX = event.clientX - this.startX();
    const newY = event.clientY - this.startY();
    this.translateX.set(newX);
    this.translateY.set(newY);
  }

  onMouseUp(): void {
    this.isDragging.set(false);
  }

  onMouseLeave(): void {
    this.isDragging.set(false);
  }

  onDeletePhoto(): void {
    this.deletePhotoRequest.emit();
  }
}
