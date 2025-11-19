import { Component } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css' 
})
export class LoginComponent {

  email = '';
  password = '';

  constructor(private auth: Auth) {}

  login() {
    signInWithEmailAndPassword(this.auth, this.email, this.password)
      .then(() => window.location.href = '/videos')
      .catch(err => alert(err.message));
  }

  loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(this.auth, provider)
      .then(() => window.location.href = '/videos')
      .catch(err => alert(err.message));
  }
}
