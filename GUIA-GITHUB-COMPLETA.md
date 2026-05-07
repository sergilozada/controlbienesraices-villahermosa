# 📚 Guía Completa para Subir tu Proyecto a GitHub

## Paso 1: Preparar tu Proyecto

### 1.1 Crear archivo .gitignore
1. Crea un archivo llamado `.gitignore` en la raíz de tu proyecto
2. Agrega este contenido:

```gitignore
# Dependencias
node_modules/
.pnpm-store/

# Archivos de build
dist/
build/

# Archivos de entorno (IMPORTANTE: protege tus credenciales)
.env
.env.local
.env.production

# Archivos de sistema
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Archivos temporales
*.tmp
*.temp

# Archivos de IDE
.vscode/
.idea/
*.swp
*.swo

# Archivos de Firebase (opcional, si usas Firebase CLI)
.firebase/
firebase-debug.log
firestore-debug.log

# Archivos de cache
.cache/
```

### 1.2 Proteger credenciales de Firebase
**IMPORTANTE**: Nunca subas tus credenciales reales a GitHub público.

Opción A - Usar variables de entorno (Recomendado):
1. Crea un archivo `.env` en la raíz:
```env
VITE_FIREBASE_API_KEY=tu-api-key-aqui
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=tu-app-id
```

2. Actualiza `src/lib/firebase.ts`:
```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

Opción B - Dejar credenciales de prueba:
Si quieres que otros puedan probar tu proyecto, puedes dejar credenciales de un proyecto de prueba.

### 1.3 Crear README.md
Crea un archivo `README.md` en la raíz:

```markdown
# 🏠 Sistema de Control de Bienes Raíces

Sistema completo para la gestión de clientes, cuotas y pagos en el sector inmobiliario.

## 🚀 Características

- ✅ Gestión completa de clientes
- ✅ Control de cuotas y pagos
- ✅ Cálculo automático de moras
- ✅ Exportación a PDF y Excel
- ✅ Subida de vouchers y boletas
- ✅ Dashboard con estadísticas
- ✅ Modo dual: localStorage y Firebase
- ✅ Autenticación segura
- ✅ Sincronización en tiempo real

## 🛠️ Tecnologías

- **Frontend**: React + TypeScript + Vite
- **UI**: Shadcn/ui + Tailwind CSS
- **Backend**: Firebase (Auth + Firestore)
- **Exportación**: jsPDF + html2canvas
- **Estado**: Zustand + React Query

## 📦 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/tu-usuario/sistema-bienes-raices.git
cd sistema-bienes-raices
```

2. Instala dependencias:
```bash
pnpm install
```

3. Configura Firebase (ver GUIA-FIREBASE-COMPLETA.md)

4. Ejecuta en desarrollo:
```bash
pnpm run dev
```

## 🔧 Configuración

### Variables de Entorno
Crea un archivo `.env` con:
```env
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=tu-app-id
```

## 👥 Usuarios de Prueba

- **Admin**: admin@bienesraices.com / REMOVED_FROM_GIT_HISTORY
- **Usuario**: usuario@bienesraices.com / REMOVED_FROM_GIT_HISTORY
- **Solo lectura**: readonly@bienesraices.com / REMOVED_FROM_GIT_HISTORY

## 📖 Guías

- [Configuración completa de Firebase](./GUIA-FIREBASE-COMPLETA.md)
- [Configuración de GitHub](./GUIA-GITHUB-COMPLETA.md)

## 🚀 Despliegue

### Firebase Hosting
```bash
pnpm run build
firebase deploy
```

### Vercel
```bash
pnpm run build
# Sube la carpeta dist/ a Vercel
```

## 📄 Licencia

MIT License - Ver [LICENSE](LICENSE) para más detalles.

## 🤝 Contribuir

1. Fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Contacto

Tu Nombre - tu.email@ejemplo.com

Link del Proyecto: [https://github.com/tu-usuario/sistema-bienes-raices](https://github.com/tu-usuario/sistema-bienes-raices)
```

## Paso 2: Crear Cuenta en GitHub

### 2.1 Registrarse en GitHub
1. Ve a https://github.com
2. Haz clic en "Sign up"
3. Completa el registro:
   - Username: elige un nombre único
   - Email: tu email
   - Password: contraseña segura
4. Verifica tu email

### 2.2 Configurar perfil (opcional)
1. Sube una foto de perfil
2. Agrega una bio
3. Agrega tu ubicación

## Paso 3: Crear Repositorio en GitHub

### 3.1 Crear nuevo repositorio
1. Haz clic en el botón "+" en la esquina superior derecha
2. Selecciona "New repository"
3. Completa la información:
   - **Repository name**: `sistema-bienes-raices`
   - **Description**: `Sistema completo de control de bienes raíces con React y Firebase`
   - **Visibility**: 
     - **Public**: Si quieres que sea visible para todos
     - **Private**: Si quieres que solo tú lo veas
4. **NO marques** "Add a README file" (ya tienes uno)
5. **NO marques** "Add .gitignore" (ya tienes uno)
6. Haz clic en "Create repository"

### 3.2 Copiar URL del repositorio
Después de crear el repositorio, copia la URL que aparece. Será algo como:
`https://github.com/tu-usuario/sistema-bienes-raices.git`

## Paso 4: Instalar y Configurar Git

### 4.1 Instalar Git
**Windows:**
1. Descarga Git desde https://git-scm.com/download/win
2. Ejecuta el instalador con las opciones por defecto

**Mac:**
```bash
# Si tienes Homebrew instalado
brew install git

# O descarga desde https://git-scm.com/download/mac
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install git
```

### 4.2 Configurar Git
Abre una terminal y ejecuta:

```bash
# Configura tu nombre (reemplaza con tu nombre real)
git config --global user.name "Tu Nombre"

# Configura tu email (usa el mismo email de GitHub)
git config --global user.email "tu.email@ejemplo.com"

# Verifica la configuración
git config --list
```

## Paso 5: Subir tu Proyecto a GitHub

### 5.1 Abrir terminal en tu proyecto
1. Abre una terminal/cmd
2. Navega a la carpeta de tu proyecto:
```bash
cd "ruta/a/tu/proyecto/control de bienes raíces"
```

### 5.2 Inicializar Git
```bash
# Inicializar repositorio Git
git init

# Agregar todos los archivos
git add .

# Hacer el primer commit
git commit -m "Initial commit: Sistema de bienes raíces completo"
```

### 5.3 Conectar con GitHub
```bash
# Conectar con tu repositorio (reemplaza con tu URL)
git remote add origin https://github.com/tu-usuario/sistema-bienes-raices.git

# Verificar la conexión
git remote -v
```

### 5.4 Subir el código
```bash
# Subir el código a GitHub
git push -u origin main
```

**Si te pide autenticación:**
- Username: tu username de GitHub
- Password: usa un Personal Access Token (no tu contraseña)

### 5.5 Crear Personal Access Token (si es necesario)
1. Ve a GitHub.com
2. Haz clic en tu foto de perfil > Settings
3. En el menú izquierdo: Developer settings > Personal access tokens > Tokens (classic)
4. Haz clic en "Generate new token (classic)"
5. Completa:
   - Note: `Sistema Bienes Raices`
   - Expiration: `90 days` (o lo que prefieras)
   - Scopes: marca `repo`
6. Haz clic en "Generate token"
7. **COPIA EL TOKEN** (no podrás verlo de nuevo)
8. Usa este token como contraseña cuando Git te lo pida

## Paso 6: Verificar que Todo Esté Subido

### 6.1 Verificar en GitHub
1. Ve a tu repositorio en GitHub
2. Deberías ver todos tus archivos
3. Verifica que el README.md se muestre correctamente

### 6.2 Verificar archivos importantes
Asegúrate de que estos archivos estén presentes:
- ✅ `src/` (carpeta con tu código)
- ✅ `package.json`
- ✅ `README.md`
- ✅ `.gitignore`
- ✅ `GUIA-FIREBASE-COMPLETA.md`
- ✅ `GUIA-GITHUB-COMPLETA.md`

## Paso 7: Comandos Git Útiles para el Futuro

### 7.1 Comandos básicos diarios
```bash
# Ver estado de archivos
git status

# Agregar archivos modificados
git add .

# Hacer commit con mensaje
git commit -m "Descripción de los cambios"

# Subir cambios a GitHub
git push

# Descargar cambios de GitHub
git pull
```

### 7.2 Trabajar con ramas
```bash
# Crear nueva rama
git checkout -b nueva-funcionalidad

# Cambiar de rama
git checkout main

# Ver todas las ramas
git branch -a

# Fusionar rama
git merge nueva-funcionalidad
```

### 7.3 Ver historial
```bash
# Ver historial de commits
git log --oneline

# Ver diferencias
git diff
```

## Paso 8: Configurar GitHub Pages (Opcional)

Si quieres que tu proyecto sea accesible públicamente:

### 8.1 Habilitar GitHub Pages
1. Ve a tu repositorio en GitHub
2. Haz clic en "Settings"
3. Scroll hacia abajo hasta "Pages"
4. En "Source" selecciona "GitHub Actions"

### 8.2 Crear workflow para deployment
Crea el archivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install pnpm
      run: npm install -g pnpm
      
    - name: Install dependencies
      run: pnpm install
      
    - name: Build
      run: pnpm run build
      
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

## 🎉 ¡Proyecto Subido Exitosamente!

Tu proyecto ya está en GitHub y disponible en:
`https://github.com/tu-usuario/sistema-bienes-raices`

## Próximos Pasos Recomendados

1. **Invitar colaboradores**: Settings > Manage access > Invite a collaborator
2. **Configurar protecciones**: Settings > Branches > Add rule
3. **Crear issues**: Para trackear bugs y mejoras
4. **Crear releases**: Para versionar tu aplicación
5. **Configurar CI/CD**: Para deployment automático

## Solución de Problemas Comunes

### Error: "Permission denied"
- Verifica que estés usando el Personal Access Token correcto
- Verifica que el token tenga permisos de `repo`

### Error: "Repository not found"
- Verifica que la URL del repositorio sea correcta
- Verifica que el repositorio exista en GitHub

### Error: "Failed to push"
- Intenta: `git pull origin main` primero
- Luego: `git push origin main`

### Archivos muy grandes
Git tiene límite de 100MB por archivo. Si tienes archivos grandes:
- Agrégalos al `.gitignore`
- Usa Git LFS para archivos grandes necesarios

¡Tu proyecto ya está en GitHub y listo para compartir! 🚀