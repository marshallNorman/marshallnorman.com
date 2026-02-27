# Portfolio Project

## Overview
Personal portfolio site built with Astro 5 + Tailwind CSS v4, managed with Bun. Scaffolded from the Astro `basics` template.

## Package Manager
Use **bun** exclusively. Never use npm or yarn.

## Dev Commands
```bash
bun run dev      # Start dev server → http://localhost:4321
bun run build    # Build for production → ./dist/
bun run preview  # Preview production build locally
```

## Project Structure
```
src/
  assets/       # Images and other assets processed by Astro
  components/   # Reusable Astro components
  layouts/
    Layout.astro # Root layout; imports global CSS
  pages/        # File-based routing (each file = a route)
  styles/
    global.css  # Tailwind entry point (@import "tailwindcss")
public/         # Static assets served as-is (favicon, etc.)
```

## Conventions

### Tailwind CSS v4
- Configured via `@tailwindcss/vite` plugin — no `tailwind.config.*` file
- Entry point: `src/styles/global.css` with `@import "tailwindcss"`
- Global CSS is imported in `src/layouts/Layout.astro`

### TypeScript
- Strict mode via `astro/tsconfigs/strict` (set in `tsconfig.json`)

### Routing
- File-based routing under `src/pages/`
- All pages should use `src/layouts/Layout.astro` as the root layout

## Notes
- No git repo initialized yet — run `git init` before making commits
- No environment variables required
- Deploy target: Vercel (`vercel` CLI, requires Node.js in PATH via NVM)
