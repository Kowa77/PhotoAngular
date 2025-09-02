// src/app/paginas/gallery/gallery.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css']
})
export class GalleryComponent implements OnInit {
  photos: any[] = [];
  userId: string | null = '';
  isLoading: boolean = true;

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.userId = params.get('userId');
      if (this.userId) {
        this.loadGallery(this.userId);
      } else {
        console.error('No se encontró el userId en la URL.');
        this.isLoading = false;
      }
    });
  }

  loadGallery(userId: string): void {
    this.isLoading = true;
    const backendUrl = `http://localhost:3000/api/gallery/${userId}`;
    this.http.get<any[]>(backendUrl).subscribe({
      next: (data) => {
        this.photos = data;
        this.isLoading = false;
        console.log('✅ Fotos cargadas con éxito:', this.photos);
      },
      error: (err) => {
        console.error('❌ Error al cargar la galería:', err);
        this.isLoading = false;
        this.photos = [];
      }
    });
  }
}
