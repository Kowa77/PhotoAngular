import { Component, OnInit, signal, WritableSignal, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-upload-form',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './upload-form.component.html',
  styleUrl: './upload-form.component.css'
})
export class UploadFormComponent implements OnInit, OnDestroy {
  // Signals for component state
  selectedFiles = signal<FileList | null>(null);
  uploadStatus = signal<string>('');
  isUploading = signal<boolean>(false);
  targetUserEmail = signal<string>(''); // Nuevo signal para el correo del usuario objetivo

  private authService: AuthService = inject(AuthService);
  private http: HttpClient = inject(HttpClient);
  private destroy$ = new Subject<void>();

  isUserAuthenticated = signal<boolean>(false);
  private currentUserUid: string | null = null;

  ngOnInit(): void {
    this.authService.getCurrentUserUid().pipe(
      takeUntil(this.destroy$)
    ).subscribe(uid => {
      this.currentUserUid = uid;
      this.isUserAuthenticated.set(!!uid);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFileSelected(event: any): void {
    this.selectedFiles.set(event.target.files);
    this.uploadStatus.set('');
  }

  onUpload(): void {
    // Validar que se ha seleccionado un archivo y se ha ingresado un email
    if (!this.selectedFiles() || this.selectedFiles()!.length === 0 || !this.targetUserEmail()) {
      this.uploadStatus.set('Por favor, selecciona al menos un archivo e ingresa el correo del usuario.');
      return;
    }

    this.isUploading.set(true);
    this.uploadStatus.set('Subiendo...');

    const formData = new FormData();
    for (let i = 0; i < this.selectedFiles()!.length; i++) {
      formData.append('photos', this.selectedFiles()![i], this.selectedFiles()![i].name);
    }

    // Pasar el correo electrónico del usuario objetivo en lugar del UID del usuario actual
    formData.append('targetUserEmail', this.targetUserEmail());

    // Make the POST request to the server
    this.http.post('http://localhost:3000/api/upload-photos', formData).subscribe({
      next: (response: any) => {
        this.uploadStatus.set('¡Fotos subidas con éxito!');
        this.isUploading.set(false);
        this.selectedFiles.set(null);
        this.targetUserEmail.set(''); // Limpiar el campo de email
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
      },
      error: (err) => {
        console.error('Error uploading photos:', err);
        this.uploadStatus.set('Error al subir fotos. Por favor, inténtalo de nuevo.');
        this.isUploading.set(false);
      }
    });
  }
}
