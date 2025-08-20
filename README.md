# Calendar Backend API

A robust NestJS backend service that provides calendar management functionality with real-time Google Calendar synchronization, webhooks, and Firebase integration.

## 🚀 Features

- **Calendar Event Management**: Full CRUD operations for calendar events
- **Google Calendar Integration**: Two-way sync with Google Calendar
- **Real-time Webhooks**: Instant updates when Google Calendar changes
- **Firebase Integration**: Secure data storage with Firestore
- **OAuth Authentication**: Google OAuth 2.0 authentication flow
- **RESTful API**: Clean and well-documented API endpoints

## 🛠 Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: Firebase Firestore
- **Authentication**: Google OAuth 2.0
- **Calendar API**: Google Calendar API v3
- **Language**: TypeScript
- **Validation**: Class Validator
- **Architecture**: Modular architecture with dependency injection

## 🔧 Project Structure

```
src/
├── auth/                      # Authentication module
│   ├── auth.controller.ts     # OAuth endpoints
│   ├── auth.service.ts        # Auth business logic
│   ├── google.strategy.ts     # Passport Google strategy
│   └── auth.module.ts         # Auth module definition
├── events/                    # Events management module
│   ├── dto/                   # Data Transfer Objects
│   ├── events.controller.ts   # Event endpoints
│   ├── events.service.ts      # Event business logic
│   ├── event.interface.ts     # Event type definitions
│   └── events.module.ts       # Events module definition
├── google-calendar/           # Google Calendar integration
│   ├── google-calendar.service.ts    # Calendar API integration
│   └── webhook-calendar.service.ts   # Webhook management
├── webhook/                   # Webhook handling
│   └── webhook.controller.ts  # Webhook endpoints
├── firebase/                  # Firebase integration
│   └── firebase.service.ts    # Firestore database service
├── app.module.ts              # Main application module
└── main.ts                    # Application entry point
```
