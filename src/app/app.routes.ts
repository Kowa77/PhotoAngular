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
import { AgendaComponent } from './agenda/agenda.component';
import { PerfilComponent } from './perfil/perfil.component';
import { GalleryComponent } from './paginas/gallery/gallery.component';
import { UploadFormComponent } from './paginas/admin/upload-form/upload-form.component';

export const routes: Routes = [
  { path: '', component: TarjetasComponent },
  { path: 'cumpleanos', component: CumpleanosComponent },
  { path: 'casamientos', component: CasamientosComponent },
  { path: 'extras', component: ExtrasComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'nosotros', component: NosotrosComponent },
  { path: 'perfil', component: PerfilComponent },
  { path: 'servicios/:categoria', component: ServiciosComponent },
  { path: 'carrito', component: CarritoComponent },
  { path: 'agenda', component: AgendaComponent },
  { path: 'admin/upload', component: UploadFormComponent },
  { path: 'galeria/:userId', component: GalleryComponent },
  { path: '**', redirectTo: '' }
];
