// src/app/paginas/admin/upload-form/upload-form.component.ts
import { Component, OnInit, signal, WritableSignal, OnDestroy, inject, ViewChild } from '@angular/core'; // <--- Añade 'ViewChild' aquí
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../auth/auth.service';
import { AdminStatsComponent } from '../admin-stats/admin-stats.component';
import { UserCountComponent } from '../user-count/user-count.component';

@Component({
  selector: 'app-upload-form',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, AdminStatsComponent, UserCountComponent ],
  templateUrl: './upload-form.component.html',
  styleUrl: './upload-form.component.css'
})
export class UploadFormComponent implements OnInit, OnDestroy {
  // Signals for component state
  selectedFiles = signal<FileList | null>(null);
  uploadStatus = signal<string>('');
  isUploading = signal<boolean>(false);
  targetUserEmail = signal<string>('');

  // Agregamos una referencia al componente hijo (AdminStatsComponent)
  @ViewChild(AdminStatsComponent) statsComponent: AdminStatsComponent | undefined;

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
      console.log('User UID:', uid);
    });
  }

  onFileSelected(event: Event) {
    const element = event.currentTarget as HTMLInputElement;
    let fileList: FileList | null = element.files;
    this.selectedFiles.set(fileList);
  }

  onUpload() {
    if (!this.selectedFiles() || this.selectedFiles()!.length === 0 || !this.isValidEmail(this.targetUserEmail())) {
      this.uploadStatus.set('Por favor, selecciona archivos y escribe un correo válido.');
      return;
    }

    this.isUploading.set(true);
    this.uploadStatus.set('Subiendo...');

    const formData = new FormData();
    for (let i = 0; i < this.selectedFiles()!.length; i++) {
      formData.append('photos', this.selectedFiles()![i], this.selectedFiles()![i].name);
    }
    formData.append('targetUserEmail', this.targetUserEmail());

    this.http.post('http://localhost:3000/api/upload-photos', formData).subscribe({
      next: (response: any) => {
        this.uploadStatus.set('¡Fotos subidas con éxito!');
        this.isUploading.set(false);
        this.selectedFiles.set(null);
        this.targetUserEmail.set('');
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }

        // Llamamos al método refreshStats() del componente hijo
        if (this.statsComponent) {
          this.statsComponent.refreshStats();
        }
      },
      error: (err: any) => {
        console.error('Error al subir fotos:', err);
        this.uploadStatus.set('Error: ' + (err.error?.error || 'No se pudieron subir las fotos.'));
        this.isUploading.set(false);
      }
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
