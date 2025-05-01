import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-modal.component.html',
  styleUrl: './login-modal.component.css'
})
export class LoginModalComponent {
  isVisible: boolean = false;
  credentials = { username: '', password: '' };
  @Output() loginSuccess = new EventEmitter<any>();
  @Output() closeModalEvent = new EventEmitter<void>();

  openModal() {
    this.isVisible = true;
  }

  closeModal() {
    this.isVisible = false;
    this.closeModalEvent.emit();
  }

  login() {
    // Aquí llama a tu servicio de autenticación para iniciar sesión
    console.log('Intentando iniciar sesión con:', this.credentials);
    // Si el inicio de sesión es exitoso, emite el evento
    this.loginSuccess.emit({ username: this.credentials.username });
    this.closeModal();
  }
}
