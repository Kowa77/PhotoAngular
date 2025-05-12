// models/carrito-data.model.ts
import { Servicio } from './servicio.model';

export interface CarritoData {
  servicios?: Servicio[];
  // Aquí puedes agregar otras propiedades que tu objeto carrito pueda tener
  // Por ejemplo, si tu carrito en Firebase también guarda la fecha de creación:
  // fechaCreacion?: Date;
  // O un identificador único del carrito por usuario (si es diferente del userId):
  // carritoId?: string;
}
