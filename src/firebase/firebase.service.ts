import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService {
  private db: admin.firestore.Firestore;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
    this.db = admin.firestore();
  }

  private initializeFirebase() {
    if (!admin.apps.length) {
      try {
        const serviceAccount = require('../../firebase-admin-key.json');

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: this.configService.get('FIREBASE_PROJECT_ID'),
        });
      } catch (error) {
        throw new Error('Firebase initialization failed');
      }
    }
  }

  getFirestore() {
    return this.db;
  }

  async testConnection(): Promise<string> {
    try {
      await this.db.collection('test').doc('connection').set({
        message: 'Firebase connected successfully!',
        timestamp: new Date(),
      });

      return 'Firebase connection successful!';
    } catch (error) {
      return `Firebase connection failed: ${error.message}`;
    }
  }
}