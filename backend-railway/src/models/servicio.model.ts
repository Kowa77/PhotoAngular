// backend-railway/src/models/servicio.model.ts

export interface Servicio {
  nombre:
    | 'Civil'
    | 'Exteriores'
    | 'Fiesta'
    | 'Getting Ready'
    | 'Iglesia'
    | 'Video de novios'
    | string;
  cantidad?: number;
  precio: number;
  // Puedes añadir otras propiedades relevantes de tus servicios aquí
}
