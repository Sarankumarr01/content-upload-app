import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { VideoListComponent } from './video-list/video-list';
import { RecycleBinComponent } from './sidebar/recycle-bin/recycle-bin';
import { LoginComponent } from './login/login';
import { AuthGuard } from './auth-guard';

export const routes: Routes = [

  // 👉 LOGIN PAGE FIRST
  { path: 'login', component: LoginComponent },

  // 👉 PROTECTED DASHBOARD + CHILDREN
  {
    path: '',
    component: Dashboard,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'videos', pathMatch: 'full' },
      { path: 'videos', component: VideoListComponent },
      { path: 'recycle', component: RecycleBinComponent }
    ]
  },

  // 👉 ANY UNKNOWN PATH → LOGIN
  { path: '**', redirectTo: 'login' }
];
