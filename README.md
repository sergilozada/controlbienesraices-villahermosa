# Shadcn-UI Template Usage Instructions

## technology stack

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

All shadcn/ui components have been downloaded under `@/components/ui`.

## File Structure

- `index.html` - HTML entry point
- `vite.config.ts` - Vite configuration file
- `tailwind.config.js` - Tailwind CSS configuration file
- `package.json` - NPM dependencies and scripts
- `src/app.tsx` - Root component of the project
- `src/main.tsx` - Project entry point
- `src/index.css` - Existing CSS configuration
- `src/pages/Index.tsx` - Home page logic

## Components

- All shadcn/ui components are pre-downloaded and available at `@/components/ui`

## Styling

- Add global styles to `src/index.css` or create new CSS files as needed
- Use Tailwind classes for styling components

## Development

- Import components from `@/components/ui` in your React components
- Customize the UI by modifying the Tailwind configuration

## Note

- The `@/` path alias points to the `src/` directory
- In your typescript code, don't re-export types that you're already importing

# Commands

**Install Dependencies**

```shell
pnpm i
```

**Add Dependencies**

```shell
# Sistema de Gestión de Bienes Raíces

Aplicación de administración de clientes, cuotas y pagos, construída con React + TypeScript + Vite.

Características principales
- Gestión de clientes
- Control y generación automática de cuotas
- Cálculo de moras
- Exportación a PDF y Excel
- Subida y descarga de vouchers/boletas
- Soporte para Firebase (Auth + Firestore) y modo local (localStorage)

Instalación
1. Clona el repositorio:

```powershell
git clone <tu-repo-url>
cd "control de bienes raíces - copia 15-10-2025"
```

2. Instala dependencias:

```powershell
pnpm install
```

3. Configura variables de entorno (ver `.env.example`)

Uso en desarrollo

```powershell
pnpm run dev
```

Build para producción

```powershell
pnpm run build
```

Variables de entorno (.env.example)

Revisa el archivo `.env.example` para las variables necesarias (Firebase). No subas credenciales reales al repositorio público.

Usuarios de prueba
- admin@bienesraices.com / REMOVED_FROM_GIT_HISTORY
- usuario@bienesraices.com / REMOVED_FROM_GIT_HISTORY
- readonly@bienesraices.com / REMOVED_FROM_GIT_HISTORY

Contribuir
- Crea una rama por feature: `git checkout -b feature/nombre`
- Haz commits pequeños y descriptivos
- Abre un Pull Request cuando esté listo

Más guías
- `GUIA-FIREBASE-COMPLETA.md`
- `GUIA-GITHUB-COMPLETA.md`

Licencia
- MIT

---
_Generado y actualizado automáticamente por utilidades del proyecto._