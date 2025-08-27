import { Component, OnInit, signal, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { FooterComponent } from './paginas/footer/footer.component';
import { AuthService } from './auth/auth.service';
import { CommonModule } from '@angular/common';

// Note: SweetAlert2 is loaded via CDN in the main HTML file,
// so it is not imported here. It is accessed as a global variable `Swal`.
declare const Swal: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'servicephoto-angular';
  isLoggedIn: boolean = false;

  // Simulate a product database
  products = signal([
    { id: 1, name: 'Sudadera con capucha', price: 49.99, image: 'https://placehold.co/400x300/000000/FFFFFF?text=SUDADERA' },
    { id: 2, name: 'Camiseta de algodón', price: 19.99, image: 'https://placehold.co/400x300/1e40af/FFFFFF?text=CAMISETA' },
    { id: 3, name: 'Jeans ajustados', price: 69.99, image: 'https://placehold.co/400x300/3b82f6/FFFFFF?text=JEANS' }
  ]);

  // Signal for the cart state
  cartItems = signal<any[]>([]);

  constructor(private authService: AuthService) {
    effect(() => {
      // Optional: A side effect to log the current cart state for debugging
      console.log('Current cart:', this.cartItems());
    });
  }

  ngOnInit(): void {
    this.authService.getAuthState().subscribe(user => {
      this.isLoggedIn = !!user;
      console.log('Authentication state in AppComponent:', this.isLoggedIn, user);
    });
  }

  // Method to add products to the cart
  addToCart(product: any) {
    this.cartItems.update(items => {
      const existingItem = items.find(item => item.id === product.id);
      if (existingItem) {
        existingItem.quantity++;
      } else {
        items.push({ ...product, quantity: 1 });
      }
      return [...items];
    });

    Swal.fire({
      icon: 'success',
      title: 'Producto añadido',
      text: `${product.name} ha sido añadido a tu carrito.`,
      showConfirmButton: false,
      timer: 1500
    });
  }

  // Method to remove products from the cart
  async removeFromCart(productId: number) {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esto eliminará el producto del carrito.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      this.cartItems.update(items => items.filter(item => item.id !== productId));
      Swal.fire(
        '¡Eliminado!',
        'El producto ha sido eliminado del carrito.',
        'success'
      );
    }
  }

  // Method to clear the entire cart
  async clearCart() {
    if (this.cartItems().length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Carrito vacío',
        text: 'Tu carrito ya está vacío. Agrega algunos productos primero.',
      });
      return;
    }

    const result = await Swal.fire({
      title: '¿Vaciar el carrito?',
      text: 'Esto eliminará todos los productos del carrito.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, vaciar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      this.cartItems.set([]);
      Swal.fire(
        'Carrito vaciado',
        'Tu carrito ha sido vaciado.',
        'info'
      );
    }
  }

  // Method to handle the checkout process
  async checkout() {
    if (this.cartItems().length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Carrito vacío',
        text: 'No puedes finalizar la compra con el carrito vacío. Agrega algunos productos primero.',
      });
      return;
    }

    await Swal.fire({
      title: '¡Compra exitosa!',
      text: 'Tu pedido ha sido procesado. Serás redirigido en breve.',
      icon: 'success',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });

    this.cartItems.set([]);
  }
}
