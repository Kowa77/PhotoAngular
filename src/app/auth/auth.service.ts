// src/app/auth/auth.service.ts
import { Injectable, inject, NgZone } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, user, User, setPersistence, browserLocalPersistence } from '@angular/fire/auth'; // ¡Auth y signOut desde @angular/fire/auth!
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public user$: Observable<User | null>;
  private auth: Auth = inject(Auth);
  private ngZone: NgZone = inject(NgZone);

  private readonly SESSION_EXPIRATION_KEY = 'sessionExpirationTime';
  private readonly SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hora en milisegundos

  constructor() {
    // user(this.auth) es un observable que emite el estado del usuario.
    // Lo envolvemos en ngZone.run para asegurar que las actualizaciones del estado del usuario
    // disparen la detección de cambios de Angular.
    this.user$ = this.ngZone.run(() => user(this.auth));
    this.checkSessionExpiration();
  }

  async registerUser(email: string, password: string): Promise<User> {
    try {
      // createUserWithEmailAndPassword y signInWithEmailAndPassword devuelven Promises.
      // Angular maneja bien las Promises con Zone.js, por lo que no es necesario
      // envolver estas llamadas en ngZone.run() explícitamente.
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
      // setPersistence también devuelve una Promise.
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
      // signOut también devuelve una Promise.
      await signOut(this.auth);
      localStorage.removeItem(this.SESSION_EXPIRATION_KEY);
    } catch (error: any) {
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
            setTimeout(() => this.logoutUser(), timeLeft); // setTimeout es manejado por Zone.js
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
