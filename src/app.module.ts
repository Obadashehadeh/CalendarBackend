import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseService } from './firebase/firebase.service';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'], // Try multiple paths
      expandVariables: true,
      cache: true,
    }),
    EventsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, FirebaseService],
})
export class AppModule {
  constructor() {
    // Debug: Check if .env is loaded
    console.log('🔧 App Module initialized');
    console.log('🔧 Environment check:');
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    console.log('  GOOGLE_CLIENT_ID exists:', !!process.env.GOOGLE_CLIENT_ID);
    console.log('  GOOGLE_CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET);
    console.log('  FIREBASE_PROJECT_ID exists:', !!process.env.FIREBASE_PROJECT_ID);

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('❌ GOOGLE_CLIENT_ID not found in environment!');
      console.log('📂 Make sure .env file exists in the backend root directory');
      console.log('📝 .env file should contain: GOOGLE_CLIENT_ID=your-client-id');
    }
  }
}