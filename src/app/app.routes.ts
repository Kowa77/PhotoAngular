import { Routes } from '@angular/router';
import { CumpleanosComponent } from './paginas/cumpleanos/cumpleanos.component'; // Actualiza la ruta
import { CasamientosComponent } from './paginas/casamientos/casamientos.component'; // Actualiza la ruta
import { ExtrasComponent } from './paginas/extras/extras.component'; // Actualiza la ruta
import { TarjetasComponent } from './tarjetas/tarjetas.component';
import { ContactoComponent } from './paginas/contacto/contacto.component';
import { NosotrosComponent } from './paginas/nosotros/nosotros.component';
import { ServiciosComponent } from './servicios/servicios.component';
import { CarritoComponent } from './carrito/carrito.component';
//import { PagoComponent } from './pago/pago.component';

export const routes: Routes = [
  { path: '*', component: TarjetasComponent },
  { path: '', component: TarjetasComponent },
  { path: 'cumpleanos', component: CumpleanosComponent },
  { path: 'casamientos', component: CasamientosComponent },
  { path: 'extras', component: ExtrasComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'nosotros', component: NosotrosComponent },
  { path: 'servicios', component: ServiciosComponent },
  { path: 'carrito', component: CarritoComponent }
  //{ path: 'pago', component: PagoComponent }
  // ... otras rutas
];
