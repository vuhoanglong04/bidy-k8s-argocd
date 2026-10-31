
# Bidy - Vietnamese Online Auction Platform (Frontend)

A modern, feature-rich auction platform built with Next.js 15, TypeScript, and Tailwind CSS. This is the frontend application that provides a responsive, real-time bidding experience for users.

## 🚀 Features

- **Real-time Bidding**: Live auction updates using Socket.io
- **Modern UI/UX**: Built with Radix UI components and Tailwind CSS
- **Responsive Design**: Mobile-first approach with dark/light mode support
- **Authentication**: JWT-based authentication with automatic token refresh
- **Image Optimization**: Advanced image handling with WebP/AVIF support
- **State Management**: Redux Toolkit with persistence
- **Data Fetching**: TanStack Query for efficient server state management
- **Form Handling**: React Hook Form with Zod validation
- **Error Boundaries**: Comprehensive error handling and recovery
- **Hydration Safety**: Production-ready SSR with client-side hydration protection r

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: Redux Toolkit + Redux Persist
- **Data Fetching**: TanStack Query
- **Forms**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Real-time**: Socket.io Client
- **Icons**: Lucide React
- **Build Tool**: Turbopack (dev), Webpack (production)

## 📋 Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Backend Server**: Bidy backend API running (see `/be` directory)

## ⚡ Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd bidy/fe

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Essential Variables:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_WS_URL=ws://localhost:8001  
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### 3. Development Server

```bash
# Start development server with Turbopack
npm run dev

# Application will be available at:
# http://localhost:3001
```

### 4. Build for Production

```bash
# Create production build
npm run build

# Start production server
npm start

# For standalone deployment
node .next/standalone/server.js
```

## 📁 Project Structure

```
fe/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── admin/          # Admin dashboard
│   │   ├── category/       # Category pages
│   │   ├── product/        # Product/auction pages
│   │   └── profile/        # User profile pages
│   ├── components/         # Reusable UI components
│   │   ├── common/         # Shared components
│   │   ├── layout/         # Layout components
│   │   ├── product/        # Product-specific components
│   │   └── ui/             # Base UI components (shadcn/ui)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility libraries
│   ├── providers/          # Context providers
│   ├── services/           # API services and data fetching
│   ├── store/              # Redux store configuration
│   ├── styles/             # Global styles
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Helper functions
├── public/                 # Static assets
├── scripts/                # Build and utility scripts
└── next.config.js          # Next.js configuration
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Create production build
npm start                # Start production server

# Code Quality  
npm run lint             # Run ESLint
npm run type-check       # TypeScript type checking

# Testing
npm run test             # Run Jest tests
npm run test:watch       # Jest in watch mode
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Playwright with UI mode

# Environment
npm run validate-env     # Validate environment variables
```

## 🌍 Environment Variables

### Essential Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8001` |
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL | `ws://localhost:8001` |
| `NEXT_PUBLIC_APP_URL` | Frontend application URL | `http://localhost:3001` |

### Feature Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_ENABLE_CHAT` | Enable chat functionality | `true` |
| `NEXT_PUBLIC_ENABLE_NOTIFICATIONS` | Enable notifications | `true` |
| `NEXT_PUBLIC_ENABLE_DARK_MODE` | Enable dark mode toggle | `true` |
| `NEXT_PUBLIC_SHOW_DEV_TOOLS` | Show development tools | `false` |

### File Upload Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_MAX_IMAGE_SIZE` | Max image upload size (bytes) | `10485760` (10MB) |
| `NEXT_PUBLIC_SUPPORTED_FORMATS` | Allowed image formats | `jpeg,jpg,png,webp` |

See `.env.example` for complete configuration options.

## 🚢 Deployment

### Standalone Deployment (Recommended)

```bash
# Set environment variable
export BUILD_STANDALONE=true

# Build for production
npm run build

# Deploy the .next/standalone folder
# Run with: node .next/standalone/server.js
```

### Standard Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Docker Deployment

```bash
# Build Docker image
docker build -t bidy-frontend .

# Run container
docker run -p 3001:3001 bidy-frontend
```

### Production Environment Setup

1. **Update Environment Variables:**
   ```bash
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   NODE_ENV=production
   ```

2. **Configure Image Domains:**
   Add your production image server to `next.config.js`:
   ```javascript
   images: {
     remotePatterns: [
       {
         protocol: 'https',
         hostname: 'your-cdn.com',
         pathname: '/images/**',
       },
     ],
   },
   ```

## 🔍 Development Guidelines

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Next.js recommended rules
- **Prettier**: Automatic code formatting
- **Imports**: Absolute imports with `@/` prefix

### Component Architecture
- **Atomic Design**: Organized component hierarchy
- **Custom Hooks**: Reusable logic extraction
- **Error Boundaries**: Graceful error handling
- **Loading States**: Consistent loading UX

### State Management
- **Redux Toolkit**: Global application state
- **TanStack Query**: Server state management
- **Local State**: React useState for component state
- **Persistence**: Redux Persist for authentication

## 🐛 Troubleshooting

### Common Issues

**Build Errors:**
```bash
# Clear build cache
rm -rf .next
npm run build
```

**Environment Issues:**
```bash
# Validate environment
npm run validate-env
```

**Hydration Errors:**
- Check for browser extensions modifying DOM
- Ensure consistent SSR/CSR rendering
- Use `suppressHydrationWarning` if needed

**Performance Issues:**
- Check bundle analyzer: `npm run build && npx @next/bundle-analyzer`
- Optimize images: Use WebP/AVIF formats
- Enable caching: Configure cache headers

### Development Tips

1. **Hot Reload Issues**: Restart dev server
2. **Type Errors**: Run `npm run type-check`
3. **Lint Issues**: Run `npm run lint -- --fix`
4. **Build Issues**: Check Next.js compatibility

## 📚 Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/docs)
- [Redux Toolkit](https://redux-toolkit.js.org/)
- [TanStack Query](https://tanstack.com/query/latest)

## 📄 License

This project is part of the Bidy auction platform. See the main repository for license information.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Built with ❤️ using Next.js 15 and modern web technologies**
