import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    // Debug: Check if ConfigService is working
    console.log('🔧 Initializing Google Strategy...');
    console.log('🔧 ConfigService available:', !!configService);

    // Get values from config service
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_REDIRECT_URI');

    // Debug: Show what we got
    console.log('🔧 Retrieved values:');
    console.log('  Client ID:', clientID ? `${clientID.substring(0, 10)}...` : 'MISSING');
    console.log('  Client Secret:', clientSecret ? `${clientSecret.substring(0, 10)}...` : 'MISSING');
    console.log('  Callback URL:', callbackURL || 'MISSING');

    // Fallback to process.env if configService fails
    const finalClientID = clientID || process.env.GOOGLE_CLIENT_ID;
    const finalClientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const finalCallbackURL = callbackURL || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

    console.log('🔧 Final values to use:');
    console.log('  Client ID:', finalClientID ? `${finalClientID.substring(0, 10)}...` : 'STILL MISSING');
    console.log('  Client Secret:', finalClientSecret ? `${finalClientSecret.substring(0, 10)}...` : 'STILL MISSING');
    console.log('  Callback URL:', finalCallbackURL);

    // Validation
    if (!finalClientID) {
      console.error('❌ GOOGLE_CLIENT_ID is missing!');
      throw new Error('GOOGLE_CLIENT_ID environment variable is required');
    }

    if (!finalClientSecret) {
      console.error('❌ GOOGLE_CLIENT_SECRET is missing!');
      throw new Error('GOOGLE_CLIENT_SECRET environment variable is required');
    }

    super({
      clientID: finalClientID,
      clientSecret: finalClientSecret,
      callbackURL: finalCallbackURL,
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'],
    });

    console.log('✅ Google Strategy initialized successfully');
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    console.log('🔑 Google OAuth validation called');
    console.log('👤 Profile ID:', profile.id);
    console.log('👤 Display Name:', profile.displayName);
    console.log('📧 Email:', profile.emails?.[0]?.value);
    console.log('🔑 Access Token length:', accessToken?.length);

    const { name, emails, photos } = profile;

    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      accessToken,
      refreshToken,
    };

    console.log('✅ User object created:', {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      hasAccessToken: !!user.accessToken
    });

    done(null, user);
  }
}