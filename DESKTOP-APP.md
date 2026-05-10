# Sistema de Bienes Raíces - Aplicación de Escritorio

Esta guía te ayudará a ejecutar y compilar la aplicación como un ejecutable (.exe) para Windows.

## 📋 Requisitos previos

- **Node.js** instalado (descargar desde https://nodejs.org/)
- **Git** instalado
- El repositorio clonado localmente

## 🚀 Instalación Inicial

### 1. Instalar dependencias
Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

Esto instalará todas las dependencias incluyendo Electron.

## 💻 Ejecutar como App de Escritorio

### Opción A: Ejecutar en modo desarrollo (Recomendado para pruebas)
En la terminal, ejecuta:

```bash
npm run dev:electron
```

Esto:
- Inicia el servidor Vite en `http://localhost:5173`
- Abre automáticamente la aplicación de escritorio
- Permite ver cambios en tiempo real (hot reload)
- Abre DevTools para debugging

### Opción B: Ejecutar solo Electron (si ya está corriendo Vite)
```bash
npm run electron
```

## 📦 Compilar como EXE (Crear instalador)

Para generar un ejecutable (.exe) que puedas distribuir:

```bash
npm run build:electron
```

Esto creará:
- **control-bienesraices Setup.exe** - Instalador para Windows
- **control-bienesraices.exe** - Ejecutable portable (sin instalación)

Los archivos estarán en la carpeta `dist/` o en una carpeta de salida del build.

## 🔄 Cómo funciona en Tiempo Real

Cuando ejecutas `npm run dev:electron`:

1. **Desarrollo local**: La app se conecta a `http://localhost:5173`
2. **Hot Reload**: Los cambios en el código se reflejan automáticamente
3. **DevTools**: Puedes inspeccionar elementos y hacer debugging
4. **Firebase Sync**: Los datos se actualizan en tiempo real desde Firebase

## 📝 Cambios en el código

Los archivos principales de la app de escritorio son:

- **`public/electron.js`** - Punto de entrada de Electron
- **`package.json`** - Scripts y configuración
- **`vite.config.ts`** - Configuración de Vite

## ⚙️ Troubleshooting

### "npm is not recognized"
Instala Node.js desde https://nodejs.org/

### "Port 5173 already in use"
Cierra la otra instancia o cambia el puerto en `vite.config.ts`

### "Electron not found"
Ejecuta `npm install` de nuevo

### La app se ve distinta en el EXE
Asegúrate de ejecutar `npm run build` antes de `npm run build:electron`

## 📱 Próximas características

- Soporte para macOS
- Auto-update
- Icono personalizado
- Firma de código

---

¿Preguntas? Contacta al equipo de desarrollo.
