# Crea Glass 2

Cross-platform application built with React Native, TypeScript, and Expo.

## Features

- **Multi-platform**: Android, iOS, and Web
- **Internationalization**: Full support for 6 languages (English, German, French, Italian, Portuguese, Spanish)
- **Permission-based access control**: Fine-grained permissions system
- **Supabase-ready architecture**: Prepared for backend integration

## Tech Stack

- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **State Management**: Zustand (auth), React Query (server state)
- **Navigation**: Expo Router (file-based routing)
- **i18n**: i18next + react-i18next
- **Storage**: AsyncStorage (mock data)

## Project Structure

```
Crea Glass/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Main tab navigation (Production, Documents, Events, Inventory)
│   ├── login.tsx          # Login screen
│   └── ...
├── src/
│   ├── components/        # Reusable components
│   ├── features/          # Feature modules (to be implemented)
│   ├── hooks/             # Custom React hooks
│   ├── i18n/              # Internationalization (6 languages)
│   ├── providers/         # Context providers
│   ├── repositories/      # Data layer (mock implementations)
│   ├── services/          # Services and API clients
│   ├── store/             # State management (Zustand)
│   ├── theme/             # Theme configuration (Monday-inspired)
│   ├── types/             # TypeScript types
│   └── utils/             # Utility functions
└── ...
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on specific platform:
```bash
npm run ios      # iOS
npm run android  # Android
npm run web      # Web
```

## Authentication

Authentication is managed through Supabase Auth. Never commit production or test
credentials to this repository; provision development users through the access
control screen or a controlled Supabase environment.

## Development Status

### ✅ LAYER 1 - Frontend Foundation (Current)

- [x] Project structure and setup
- [x] Internationalization (i18n) - 6 languages
- [x] Theme system (Monday-inspired)
- [x] Permission system
- [x] Authentication store (Zustand)
- [x] Mock repositories (9 repositories)
- [x] Navigation structure (4 tabs + menu)
- [x] Login screen
- [x] Basic pages (Production, Documents, Events, Inventory)
- [x] Menu pages (Profile, Settings, Access Controls, Blood Priority)
- [x] Notification center
- [ ] QR Code adapters
- [ ] NFC adapters
- [ ] Full page implementations

### ⏳ LAYER 2 - Backend Integration (Planned)

- [ ] Supabase setup
- [ ] Database schema and migrations
- [ ] Row Level Security (RLS) policies
- [ ] Supabase repositories (replace mocks)
- [ ] Storage configuration
- [ ] Edge Functions (if needed)

## Key Rules

1. **No hardcoded strings**: All user-facing text must use i18n
2. **Permission-based UI**: Buttons/actions are hidden if user lacks permission
3. **Backend validation**: All permissions validated server-side (when backend is integrated)
4. **Master user only**: Only Master user can manage users and permissions
5. **Fixed navigation**: 4 tabs in fixed order (Production, Documents, Events, Inventory)

## Contributing

1. Follow TypeScript best practices
2. Use English for all code (variables, functions, files)
3. Ensure all strings are internationalized
4. Add permissions for new actions
5. Update Access Controls page for new permissions

## License

[Your License Here]
