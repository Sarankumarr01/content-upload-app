import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../sidebar/sidebar';
import { RouterOutlet } from '@angular/router';

import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User
} from '@angular/fire/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    Sidebar,
    RouterOutlet
  ],
  template: `
    <div class="layout">

      <!-- Sidebar -->
      <app-sidebar></app-sidebar>

      <!-- Main Content -->
      <div class="main">
        <header class="topbar-compact">
          <button class="hamburger" aria-label="menu">☰</button>

          <div class="page-title">
            <div class="title">Dashboard</div>
            <div class="subtitle">Manage your media</div>
          </div>

          <!-- RIGHT SIDE USER / LOGIN -->
          <div class="top-actions">

            <!-- IF LOGGED OUT -->
            <button *ngIf="!user"
                    class="login-btn"
                    (click)="login()">
              Login
            </button>

            <!-- IF LOGGED IN — USER BUBBLE -->
            <div *ngIf="user" class="user-wrapper">
              <div class="user" (click)="toggleDropdown()">
                <img *ngIf="user.photoURL"
                     [src]="user.photoURL"
                     alt="avatar"/>
                <span *ngIf="!user.photoURL">
                  {{ user.displayName?.[0] || 'U' }}
                </span>
              </div>

              <!-- DROPDOWN -->
              <div *ngIf="showDropdown" class="dropdown">
                <button class="dropdown-item" (click)="logout()">
                  Logout
                </button>
              </div>
            </div>

          </div>
        </header>

        <main class="content">
          <router-outlet></router-outlet>
        </main>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      font-family: "Inter", "Roboto", Arial, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      overflow: hidden;
    }

    .layout {
      display: flex;
      height: 100%;
      overflow: hidden;
    }

    .topbar-compact {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 28px;
      background: #ffffff;
      border-bottom: 1px solid #e6eefb;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      height: 64px;
    }

    .hamburger {
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: transparent;
      border: 1px solid transparent;
      font-size: 18px;
      cursor: pointer;
      color: #374151;
    }

    .page-title { display: flex; flex-direction: column; }
    .page-title .title { font-size: 20px; font-weight: 700; color: #0f172a; }
    .page-title .subtitle { margin-top: 4px; font-size: 12.5px; color: #6b7280; }

    .top-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
    }

    /* LOGIN BUTTON */
    .login-btn {
      background: #2563eb;
      color: white;
      padding: 8px 14px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-weight: 600;
    }
    .login-btn:hover { background: #1d4ed8; }

    /* USER BUBBLE */
    .user-wrapper { position: relative; }

    .user {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #3b82f6;
      color: white;
      font-weight: 600;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      overflow: hidden;
    }

    .user img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    /* DROPDOWN */
    .dropdown {
      position: absolute;
      right: 0;
      top: 48px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      width: 130px;
      padding: 8px 0;
      z-index: 20;
    }

    .dropdown-item {
      width: 100%;
      padding: 10px 14px;
      background: white;
      border: none;
      text-align: left;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
    }

    .dropdown-item:hover {
      background: #f1f5f9;
    }

    .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .content { flex: 1; overflow-y: auto; padding: 32px 40px; display: flex; flex-direction: column; gap: 36px; }
  `]
})
export class Dashboard {

  private auth = inject(Auth);
  user: User | null = null;

  showDropdown = false;

  constructor() {
    this.auth.onAuthStateChanged(u => this.user = u);
  }

  async login() {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }

  async logout() {
    await signOut(this.auth);
    this.showDropdown = false;
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-wrapper')) {
      this.showDropdown = false;
    }
  }
}
