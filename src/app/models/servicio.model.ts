// src/app/models/servicio.model.ts

export interface Servicio {
  id: string; // ID del nodo en Firebase
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string; // URL de la imagen
  categoria: 'foto' | 'video' | 'extra' | 'sugerido'; // Tipo de categoría
  duracion?: number; // Duración en número (ej. minutos), opcional
  // Puedes añadir otras propiedades específicas si las necesitas
}
