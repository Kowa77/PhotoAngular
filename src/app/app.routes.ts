import { Routes } from '@angular/router';
import { CumpleanosComponent } from './paginas/cumpleanos/cumpleanos.component'; // Actualiza la ruta
import { CasamientosComponent } from './paginas/casamientos/casamientos.component'; // Actualiza la ruta
import { ExtrasComponent } from './paginas/extras/extras.component'; // Actualiza la ruta
import { TarjetasComponent } from './tarjetas/tarjetas.component';

export const routes: Routes = [
  { path: '', component: TarjetasComponent },
  { path: 'cumpleanos', component: CumpleanosComponent },
  { path: 'casamientos', component: CasamientosComponent },
  { path: 'extras', component: ExtrasComponent },
  // ... otras rutas
];
