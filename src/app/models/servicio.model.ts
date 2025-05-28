// src/app/models/servicio.model.ts
export interface Servicio {
  id: string; // La clave única de Firebase (ahora 'id' en lugar de 'key')
  nombre: string;
  descripcion: string;
  imagen: string;
  precio: number;
  duracion?: string; // Solo para los extras, es opcional
}

// export interface Servicio {
//   key?: string; // ID único de Firebase
//   nombre_e: string;
//   descripcion_e: string;
//   precio_e: number;
//   imagen_e: string;
//   duracion_e?: string; // Opcional, para servicios que tienen duración
//   categoria: string; // 'casamientos', 'cumpleanos', 'extras'
//   seleccionado?: boolean; // Para el estado del checkbox en el carrito
// }
