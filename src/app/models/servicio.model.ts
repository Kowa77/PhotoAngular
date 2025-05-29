// src/app/models/servicio.model.ts

export interface Servicio {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string;
  duracion?: string; // Propiedad opcional para videos o extras
  categoria: 'foto' | 'video' | 'extra'; // Último cambio: tipado específico para la categoría
}
