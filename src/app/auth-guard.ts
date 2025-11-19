import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  private router = inject(Router);
  private auth = inject(Auth);

  canActivate(): Promise<boolean> {
    return new Promise(resolve => {
      onAuthStateChanged(this.auth, user => {
        if (user) {
          resolve(true);
        } else {
          this.router.navigate(['/login']);
          resolve(false);
        }
      });
    });
  }
}
