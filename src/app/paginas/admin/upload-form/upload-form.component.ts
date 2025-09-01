// src/app/paginas/admin/upload-form/upload-form.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-upload-form',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './upload-form.component.html',
  styleUrls: ['./upload-form.component.css']
})
export class UploadFormComponent {
  selectedFile: File | null = null;
  userId: string = ''; // ID del usuario al que se subirá la foto
  uploadStatus: string = '';
  isUploading: boolean = false;

  constructor(private http: HttpClient) {}

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
  }

  onUpload(): void {
    if (!this.selectedFile || !this.userId) {
      this.uploadStatus = 'Por favor, selecciona un archivo y escribe un ID de usuario.';
      return;
    }

    this.isUploading = true;
    this.uploadStatus = 'Subiendo...';

    const formData = new FormData();
    formData.append('photo', this.selectedFile, this.selectedFile.name);

    this.http.post(`http://localhost:3000/api/upload-photo/${this.userId}`, formData)
      .subscribe({
        next: (response: any) => {
          this.uploadStatus = `¡Foto subida con éxito! URL: ${response.photo.baseUrl}`;
          this.isUploading = false;
        },
        error: (error) => {
          console.error('Error al subir la foto:', error);
          this.uploadStatus = 'Error al subir la foto. Revisa la consola para más detalles.';
          this.isUploading = false;
        }
      });
  }
}
