import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// Firebase (MODULAR)
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

const firebaseConfig = {
  //your firebase confif here
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
