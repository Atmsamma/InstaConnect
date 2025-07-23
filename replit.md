# Instagram Login Application

## Overview

This is a full-stack web application that provides an Instagram login interface. The application features a React frontend with shadcn/ui components and an Express.js backend that integrates with Instagram's authentication system via a Python script using the instagrapi library.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modern full-stack architecture with clear separation between frontend and backend concerns:

- **Frontend**: React with TypeScript, using Vite as the build tool
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM (configured but minimal usage)
- **External Integration**: Python script for Instagram authentication via instagrapi
- **UI Framework**: shadcn/ui components with Tailwind CSS
- **State Management**: TanStack Query for server state management

## Key Components

### Frontend Architecture
- **React Router**: Uses wouter for client-side routing
- **UI Components**: Built with shadcn/ui and Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Forms**: React Hook Form with Zod validation
- **State Management**: TanStack Query for API state, React hooks for local state

### Backend Architecture
- **Express Server**: RESTful API with TypeScript
- **Database Layer**: Drizzle ORM with PostgreSQL (Neon Database)
- **Authentication Service**: Python subprocess integration for Instagram login
- **Session Management**: In-memory storage with planned PostgreSQL session store
- **Error Handling**: Centralized error middleware

### Database Schema
- **Users Table**: Basic user information (id, username, password)
- **Session Management**: Configured for connect-pg-simple but using memory storage

### Instagram Integration
- **Python Script**: Uses instagrapi library for Instagram authentication
- **Multi-step Auth**: Handles 2FA, challenge verification, and session reuse
- **Session Persistence**: Saves Instagram sessions to JSON files

## Data Flow

1. **Login Process**:
   - User enters credentials in React form
   - Frontend sends POST request to `/api/login`
   - Backend spawns Python subprocess with credentials
   - Python script handles Instagram authentication flow
   - Various modals handle 2FA and challenge verification
   - Success/failure response returned to frontend

2. **Authentication States**:
   - Session reuse detection
   - Two-factor authentication requirement
   - Challenge method selection (SMS/Email)
   - Challenge code verification
   - Final login success/failure

3. **UI State Management**:
   - Modal state management for different auth steps
   - Loading states during authentication
   - Toast notifications for user feedback
   - Form validation and error display

## External Dependencies

### Frontend Dependencies
- **React Ecosystem**: React 18, React DOM, React Hook Form
- **UI Framework**: shadcn/ui components, Radix UI primitives
- **Styling**: Tailwind CSS, class-variance-authority, clsx
- **State Management**: TanStack Query
- **Build Tools**: Vite, TypeScript, PostCSS

### Backend Dependencies
- **Server**: Express.js, TypeScript
- **Database**: Drizzle ORM, @neondatabase/serverless
- **Session**: connect-pg-simple (configured but not active)
- **Development**: tsx for TypeScript execution

### Python Dependencies
- **Instagram API**: instagrapi library
- **Authentication**: Handles Instagram's security mechanisms

## Deployment Strategy

### Development
- **Frontend**: Vite dev server with hot module replacement
- **Backend**: tsx for TypeScript execution with automatic restart
- **Database**: Neon Database (serverless PostgreSQL)
- **Python**: Direct subprocess execution

### Production Build
- **Frontend**: Vite build to static files served by Express
- **Backend**: esbuild compilation to ESM bundle
- **Database**: Production Neon Database instance
- **Environment**: Node.js with DATABASE_URL environment variable

### Build Commands
- `npm run dev`: Development server
- `npm run build`: Production build (frontend + backend)
- `npm run start`: Production server
- `npm run db:push`: Database schema deployment

### Architecture Decisions

1. **Monorepo Structure**: All code in single repository with shared types
2. **TypeScript**: Full TypeScript coverage for type safety
3. **Python Integration**: Subprocess approach for Instagram API to leverage existing library
4. **Modal-based UX**: Step-by-step authentication flow with clear user guidance
5. **Memory Storage**: Temporary solution with easy migration path to PostgreSQL
6. **Component Library**: shadcn/ui for consistent, accessible UI components
7. **Build Optimization**: Separate frontend/backend builds with shared dependencies

The application prioritizes user experience with clear authentication flows, proper error handling, and responsive design while maintaining clean separation of concerns and type safety throughout the stack.