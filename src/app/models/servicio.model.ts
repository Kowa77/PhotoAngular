// src/app/models/servicio.model.ts

export interface Servicio {
  id: string; // ID del nodo en Firebase
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string; // URL de la imagen
  categoria: 'foto' | 'video' | 'extra'; // Tipo de categoría
  duracion?: number; // Duración en número (ej. minutos), opcional
  cantidad: number; // <--- ¡Asegúrate de añadir esta línea!
  // Puedes añadir otras propiedades específicas si las necesitas
}

// // src/app/models/servicio.model.ts

// export interface Servicio {
//   id: string; // ID del nodo en Firebase
//   nombre: string;
//   descripcion: string;
//   precio: number;
//   imagen: string; // URL de la imagen
//   categoria: 'foto' | 'video' | 'extra'; // Tipo de categoría
//   duracion?: number; // Duración en número (ej. minutos), opcional
//   // Puedes añadir otras propiedades específicas si las necesitas
// }
