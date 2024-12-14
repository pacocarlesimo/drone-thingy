import { Routes } from '@angular/router';
import { DroneTrajectoryComponent } from './drone-trajectory/drone-trajectory.component';
import {NewTrajectoryComponent} from './new-trajectory/NewTrajectory';

export const routes: Routes = [
  { path: '', redirectTo: '/drone', pathMatch: 'full' }, // Reindirizza alla pagina del drone
  { path: 'drone', component: DroneTrajectoryComponent }, // Percorso della pagina del drone
  { path: 'trajectory', component: NewTrajectoryComponent }
];
