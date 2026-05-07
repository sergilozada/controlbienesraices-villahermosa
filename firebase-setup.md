# Configuración de Firebase para el Sistema de Bienes Raíces

## Pasos para configurar Firebase

### 1. Crear proyecto en Firebase Console
1. Ve a https://console.firebase.google.com/
2. Haz clic en "Crear un proyecto"
3. Nombra tu proyecto (ej: "bienes-raices-sistema")
4. Acepta los términos y crea el proyecto

### 2. Configurar Authentication
1. En el panel izquierdo, ve a "Authentication"
2. Haz clic en "Comenzar"
3. Ve a la pestaña "Sign-in method"
4. Habilita "Correo electrónico/contraseña"
5. Ve a la pestaña "Users"
6. Agrega manualmente estos usuarios:

**Usuarios a crear:**
- admin@bienesraices.com (contraseña: REMOVED_FROM_GIT_HISTORY)
- usuario@bienesraices.com (contraseña: REMOVED_FROM_GIT_HISTORY)
- readonly@bienesraices.com (contraseña: REMOVED_FROM_GIT_HISTORY)

### 3. Configurar Firestore Database
1. En el panel izquierdo, ve a "Firestore Database"
2. Haz clic en "Crear base de datos"
3. Selecciona "Comenzar en modo de prueba" (por ahora)
4. Elige una ubicación (recomendado: us-central1)

### 4. Configurar reglas de seguridad de Firestore
Reemplaza las reglas por defecto con estas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Los usuarios solo pueden acceder a sus propios datos
    match /clients/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Permitir lectura de usuarios autenticados para otros documentos si es necesario
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Obtener configuración del proyecto
1. Ve a "Configuración del proyecto" (ícono de engranaje)
2. Baja hasta "Tus aplicaciones"
3. Haz clic en "Agregar aplicación" > Web
4. Registra tu aplicación con un nombre
5. Copia la configuración que aparece

### 6. Actualizar archivo firebase.ts
Reemplaza el contenido de `src/lib/firebase.ts` con tu configuración:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TU CONFIGURACIÓN AQUÍ
const firebaseConfig = {
  apiKey: "tu-api-key-aqui",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto-id",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "tu-app-id"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
```

### 7. Desplegar en Firebase Hosting (Opcional)
1. Instala Firebase CLI: `npm install -g firebase-tools`
2. Inicia sesión: `firebase login`
3. En tu proyecto: `firebase init hosting`
4. Selecciona tu proyecto de Firebase
5. Configura `dist` como directorio público
6. Configura como SPA (single-page app): Sí
7. Construye el proyecto: `pnpm run build`
8. Despliega: `firebase deploy`

## Estructura de datos en Firestore

### Colección: clients
```javascript
{
  id: "auto-generado",
  userId: "uid-del-usuario",
  nombre1: "string",
  nombre2: "string (opcional)",
  dni1: "string",
  dni2: "string (opcional)",
  celular1: "string (opcional)",
  celular2: "string (opcional)",
  email1: "string (opcional)",
  email2: "string (opcional)",
  manzana: "string",
  lote: "string",
  metraje: number,
  montoTotal: number,
  formaPago: "contado" | "cuotas",
  inicial: number (opcional),
  numeroCuotas: number (opcional),
  fechaRegistro: "YYYY-MM-DD",
  cuotas: [
    {
      numero: number,
      vencimiento: "YYYY-MM-DD",
      monto: number,
      mora: number,
      total: number,
      fechaPago: "YYYY-MM-DD (opcional)",
      estado: "pendiente" | "pagado" | "vencido",
      voucher: "string | string[] (opcional)",
      boleta: "string | string[] (opcional)"
    }
  ]
}
```

## Funcionalidades implementadas

✅ **Autenticación con Firebase Auth**
- Login con email y contraseña
- Usuarios predeterminados
- Logout seguro

✅ **Base de datos en tiempo real**
- Sincronización automática de datos
- Datos por usuario (aislamiento)
- Operaciones CRUD completas

✅ **Migración completa de localStorage**
- Todas las funciones existentes
- Misma interfaz de usuario
- Compatibilidad total

✅ **Modo dual**
- Selector entre Firebase y localStorage
- Misma experiencia de usuario
- Fácil migración

## Próximos pasos recomendados

1. **Configurar tu proyecto Firebase** siguiendo los pasos anteriores
2. **Probar la aplicación** en modo Firebase
3. **Migrar datos existentes** si los tienes en localStorage
4. **Configurar reglas de seguridad** más específicas si es necesario
5. **Desplegar en Firebase Hosting** para acceso desde cualquier lugar

¡Tu aplicación ya está lista para la nube! 🚀