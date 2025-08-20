import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getHello(): Promise<string> {
    return await this.appService.getHello();
  }

  @Get('debug/env')
  getEnvDebug() {
    return {
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID ? 'Found' : 'Missing',
      googleClientId: process.env.GOOGLE_CLIENT_ID ? 'Found' : 'Missing',
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET
        ? 'Found'
        : 'Missing',
      port: process.env.PORT,
      nodeEnv: process.env.NODE_ENV,
    };
  }
}
