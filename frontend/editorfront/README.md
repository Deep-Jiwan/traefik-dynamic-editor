# Editor Front

React-based extension for Traefik Dynamic Configuration Editor.

## Architecture

This project is designed to integrate with the Traefik WebUI dashboard. It follows the same technology stack and patterns:

### Tech Stack
- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **React Router DOM** - Client-side routing
- **SWR** - Data fetching and caching
- **Tailwind CSS** - Utility-first styling
- **Vitest** - Testing framework
- **React Testing Library** - Component testing

### Project Structure
```
src/
  ├── components/     # Reusable UI components
  ├── contexts/       # React context providers
  ├── hooks/          # Custom React hooks
  ├── libs/           # Utility libraries (fetch, etc.)
  ├── pages/          # Page components
  ├── types/          # TypeScript type definitions
  └── utils/          # Helper functions
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:prod` - Run tests, lint, and build
- `npm run test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint code
- `npm run lint:fix` - Lint and fix code
- `npm run format` - Format code with Prettier

## Development

The project is configured to match the Traefik WebUI architecture for seamless integration:
- Path aliases via `vite-tsconfig-paths`
- Consistent TypeScript configuration
- Shared linting and formatting rules
- Compatible React and dependency versions

## Integration Notes

This editor is designed as an extension to the Traefik Dashboard. While it's a standalone project during development, it follows the same patterns and can be integrated into the main dashboard routing system when ready.
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
