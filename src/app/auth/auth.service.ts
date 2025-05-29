import { Injectable, inject, NgZone } from '@angular/core'; // <-- Importa NgZone
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, user, User, setPersistence, browserLocalPersistence } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public user$: Observable<User | null>;
  private auth: Auth = inject(Auth);
  private ngZone: NgZone = inject(NgZone); // <-- Inyecta NgZone

  private readonly SESSION_EXPIRATION_KEY = 'sessionExpirationTime';
  private readonly SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hora en milisegundos

  constructor() {
    // Envuelve la llamada a user() con ngZone.run()
    this.user$ = this.ngZone.run(() => user(this.auth));
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
    // Las operaciones async/await como loginUser, registerUser y logoutUser
    // suelen ser detectadas automáticamente por Zone.js si están dentro de un contexto de Angular
    // No deberían necesitar NgZone.run() explícito a menos que surjan advertencias específicas.
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      await setPersistence(this.auth, browserLocalPersistence);
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

  getCurrentUserEmail(): Observable<string | null> {
    return this.user$.pipe(
      map(user => user ? user.email : null)
    );
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
