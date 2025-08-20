import { Injectable } from '@nestjs/common';
import { FirebaseService } from './firebase/firebase.service';

@Injectable()
export class AppService {
  constructor(private firebaseService: FirebaseService) {}

  async getHello(): Promise<string> {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const firebaseStatus = await this.firebaseService.testConnection();

    return `Hello World! Project: ${projectId} | ${firebaseStatus}`;
  }
}
