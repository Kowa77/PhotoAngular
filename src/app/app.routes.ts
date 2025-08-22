// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { CumpleanosComponent } from './paginas/cumpleanos/cumpleanos.component';
import { CasamientosComponent } from './paginas/casamientos/casamientos.component';
import { ExtrasComponent } from './paginas/extras/extras.component';
import { TarjetasComponent } from './tarjetas/tarjetas.component';
import { ContactoComponent } from './paginas/contacto/contacto.component';
import { NosotrosComponent } from './paginas/nosotros/nosotros.component';
import { ServiciosComponent } from './servicios/servicios.component';
import { CarritoComponent } from './carrito/carrito.component';
import { AgendaComponent } from './agenda/agenda.component'; // Importa el nuevo componente
import { PerfilComponent } from './perfil/perfil.component';

export const routes: Routes = [
  { path: '', component: TarjetasComponent }, // Ruta por defecto
  { path: 'cumpleanos', component: CumpleanosComponent },
  { path: 'casamientos', component: CasamientosComponent },
  { path: 'extras', component: ExtrasComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'nosotros', component: NosotrosComponent },
  { path: 'perfil', component: PerfilComponent },
  { path: 'servicios/:categoria', component: ServiciosComponent },
  { path: 'carrito', component: CarritoComponent },
  { path: 'agenda', component: AgendaComponent }, // Nueva ruta para la agenda
  { path: '**', redirectTo: '' } // Cualquier otra ruta redirige a la página principal
];
