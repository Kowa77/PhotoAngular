export interface Servicio {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string;
  duracion?: string; // Para extras, opcional
  categoria: 'foto' | 'video' | 'extra'; // Añadido para compatibilidad
}
