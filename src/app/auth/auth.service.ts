import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, user, User, setPersistence, browserLocalPersistence } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public user$: Observable<User | null>;
  private auth: Auth = inject(Auth); // Inyectamos el servicio Auth a nivel de la clase

  private readonly SESSION_EXPIRATION_KEY = 'sessionExpirationTime';
  private readonly SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hora en milisegundos

  constructor() {
    this.user$ = user(this.auth);
    this.checkSessionExpiration();
  }

  async registerUser(email: string, password: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      console.error('Error al registrar usuario:', error);
      return Promise.reject(error);
    }
  }

  async loginUser(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      await setPersistence(this.auth, browserLocalPersistence); // Usamos la instancia inyectada en el constructor
      localStorage.setItem(this.SESSION_EXPIRATION_KEY, (Date.now() + this.SESSION_DURATION_MS).toString());
      return userCredential.user;
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      return Promise.reject(error);
    }
  }

  async logoutUser(): Promise<void> {
    try {
      await signOut(this.auth);
      localStorage.removeItem(this.SESSION_EXPIRATION_KEY);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  }

  getAuthState(): Observable<User | null> {
    return this.user$;
  }

  private checkSessionExpiration(): void {
    this.user$.subscribe(user => {
      if (user) {
        const expirationTime = localStorage.getItem(this.SESSION_EXPIRATION_KEY);
        if (expirationTime) {
          const expiration = parseInt(expirationTime, 10);
          if (Date.now() > expiration) {
            console.log('Sesión expirada automáticamente.');
            this.logoutUser();
          } else {
            const timeLeft = expiration - Date.now();
            setTimeout(() => this.logoutUser(), timeLeft);
          }
        }
      }
    });
  }

  getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'Este correo electrónico ya está en uso.';
      case 'auth/invalid-email':
        return 'El correo electrónico no es válido.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/user-not-found':
        return 'No se encontró ningún usuario con este correo electrónico.';
      case 'auth/wrong-password':
        return 'La contraseña es incorrecta.';
      default:
        return 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.';
    }
  }
}
