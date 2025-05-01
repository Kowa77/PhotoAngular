import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-modal.component.html',
  styleUrl: './register-modal.component.css'
})
export class RegisterModalComponent {
  isVisible: boolean = false;
  registrationData = { email: '', username: '', password: '' };
  @Output() registerSuccess = new EventEmitter<any>();
  @Output() closeModalEvent = new EventEmitter<void>();

  openModal() {
    this.isVisible = true;
  }

  closeModal() {
    this.isVisible = false;
    this.closeModalEvent.emit();
  }

  register() {
    // Aquí llama a tu servicio de autenticación para registrar al usuario
    console.log('Intentando registrar con:', this.registrationData);
    // Si el registro es exitoso, emite el evento
    this.registerSuccess.emit({ username: this.registrationData.username });
    this.closeModal();
  }
}
