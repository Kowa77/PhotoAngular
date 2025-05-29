// src/app/models/cart.model.ts

/**
 * Representa un servicio individual dentro del carrito de compras.
 * Incluye los detalles del servicio y la cantidad seleccionada.
 */
export interface CartItem {
  id: string; // El ID único del servicio (ej. 'foto1', 'videoA')
  nombre: string;
  descripcion: string;
  precio: number;
  cantidad: number; // La cantidad de este servicio en el carrito
  imagen?: string;    // Añadido para permitir la propiedad 'imagen', opcional
  categoria?: string; // Añadido para permitir la propiedad 'categoria', opcional
  duracion?: number;  // Añadido para permitir la propiedad 'duracion', opcional y tipo number
}

/**
 * Representa el carrito de compras completo de un usuario.
 * Contiene un mapa de CartItem (donde la clave es el serviceId) y el total.
 */
export interface Cart {
  items: { [serviceId: string]: CartItem }; // Un objeto donde las claves son serviceId y los valores son CartItem
  total: number; // El precio total acumulado de todos los ítems en el carrito
}
