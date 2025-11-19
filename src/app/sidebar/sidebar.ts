import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  template: `
    <aside class="sidebar">
      <div class="logo">🎬Content<span> Uploader</span></div>

      <nav>
       
       <a routerLink="videos">Dashboard</a>


<a routerLink="recycle">Recycle Bin</a>
      </nav>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 220px;
      background: #0f172a;
      color: #e2e8f0;
      display: flex;
      flex-direction: column;
      padding: 24px 16px;
      height: 100vh;
    }
    .logo {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 28px;
      color: #fff;
    }
    .logo span { color: #3b82f6; }

    nav a {
      display: block;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 8px;
      font-size: 15px;
      color: rgba(255, 255, 255, 0.85);
      text-decoration: none;
      transition: 0.2s;
    }

    nav a.active,
    nav a:hover {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }
  `]
})
export class Sidebar {}
