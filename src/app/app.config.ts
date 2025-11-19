import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// Firebase (MODULAR)
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDIm_WRfscgh7wqu7jkunIv0V8Y4fB7IX0",
  authDomain: "content-uploader-5f4df.firebaseapp.com",
  projectId: "content-uploader-5f4df",
  storageBucket: "content-uploader-5f4df.firebasestorage.app",
  messagingSenderId: "165973742297",
  appId: "1:165973742297:web:26c7250425e77dfaeda4c8",
  measurementId: "G-ZZH4CG378P"
};

export const appConfig: ApplicationConfig = {
  providers: [

    // Angular Router
    provideRouter(routes),

    // Firebase Modular Initialization
    provideFirebaseApp(() => initializeApp(firebaseConfig)),

    // Modular Firebase Services
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage())
  ]
};
