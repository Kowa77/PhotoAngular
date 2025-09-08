import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { updateProfile, User } from 'firebase/auth';

@Component({
  selector: 'app-register-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-modal.component.html',
  styleUrl: './register-modal.component.css'
})
export class RegisterModalComponent {
  isVisible: boolean = false;
  registrationData = { email: '', password: '' };
  errorMessage: string = '';
  @Output() registerSuccess = new EventEmitter<any>();
  @Output() closeModalEvent = new EventEmitter<void>();

  constructor(private authService: AuthService) {}

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
      const user = await this.authService.registerUser(
        this.registrationData.email,
        this.registrationData.password
      );

      // ✅ Si el usuario se creó, actualizamos su perfil con foto genérica
      if (user && user.user) {
        await updateProfile(user.user as User, {
          displayName: this.registrationData.email,
          photoURL: "https://i.ibb.co/xKFFqvhd/foto-Perfil.png" // <-- avatar genérico
        });
      }

      this.registerSuccess.emit(user);
      this.closeModal();
    } catch (error: any) {
      this.errorMessage = this.authService.getErrorMessage(error.code);
    }
  }
}
