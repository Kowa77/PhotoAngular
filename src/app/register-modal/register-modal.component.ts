import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service'; // Importa el AuthService

@Component({
  selector: 'app-register-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-modal.component.html',
  styleUrl: './register-modal.component.css'
})
export class RegisterModalComponent {
  isVisible: boolean = false;
  registrationData = { email: '', password: '' }; // Solo necesitamos email y password para el registro básico
  errorMessage: string = '';
  @Output() registerSuccess = new EventEmitter<any>();
  @Output() closeModalEvent = new EventEmitter<void>();

  constructor(private authService: AuthService) { } // Inyecta el AuthService

  openModal() {
    this.isVisible = true;
    this.errorMessage = '';
  }

  closeModal() {
    this.isVisible = false;
    this.closeModalEvent.emit();
  }

  async register() {
    try {
      const user = await this.authService.registerUser(this.registrationData.email, this.registrationData.password);
      //console.log('Registro exitoso:', user);
      this.registerSuccess.emit(user);
      this.closeModal();
    } catch (error: any) {
      //console.error('Error al registrar:', error);
      this.errorMessage = this.authService.getErrorMessage(error.code); // Usa el método del servicio
    }
  }
}
