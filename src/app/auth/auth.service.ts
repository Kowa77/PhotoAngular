import { Injectable } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, user, User, setPersistence, browserLocalPersistence } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public user$: Observable<User | null>;
  private auth: Auth;
  private readonly SESSION_EXPIRATION_KEY = 'sessionExpirationTime';
  private readonly SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hora en milisegundos

  constructor(auth: Auth) {
    this.auth = auth;
    this.user$ = user(this.auth);
    this.checkSessionExpiration(); // Verificar al inicio del servicio
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

  // async loginUser(email: string, password: string): Promise<User> {
  //   try {
  //     await setPersistence(this.auth, browserLocalPersistence); // Configura la persistencia local
  //     const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
  //     return userCredential.user;
  //   } catch (error: any) {
  //     console.error('Error al iniciar sesión:', error);
  //     return Promise.reject(error);
  //   }
  // }

  async loginUser(email: string, password: string): Promise<User> {
    try {
      await setPersistence(this.auth, browserLocalPersistence);
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      localStorage.setItem(this.SESSION_EXPIRATION_KEY, (Date.now() + this.SESSION_DURATION_MS).toString()); // Guardar hora de expiración
      return userCredential.user;
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      return Promise.reject(error);
    }
  }

  async logoutUser(): Promise<void> {
    try {
      localStorage.removeItem(this.SESSION_EXPIRATION_KEY); // Limpiar la hora de expiración al cerrar sesión
      await signOut(this.auth);
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
            this.logoutUser(); // Cierra la sesión si ha expirado
          } else {
            // Opcional: Puedes programar una verificación futura para la expiración
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
