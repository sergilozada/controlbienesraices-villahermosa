---
tags:
  - backlog
  - deuda-tecnica
  - seguridad
actualizado: 2026-08-21
---

# Mejoras pendientes

[[Inicio|← Inicio]] · [[Arquitectura]] · [[Funciones-principales]] · [[Flujos-del-sistema]] · [[Base-de-datos]]

> [!note] Criterio
> Los hallazgos siguientes provienen del código y la configuración local. Cuando falta una pieza —por ejemplo reglas de Firebase— se afirma únicamente que **no está versionada**, no que el proyecto remoto esté necesariamente abierto.

## Resumen de prioridades

```mermaid
flowchart LR
    P0[P0 Seguridad y datos] --> P1[P1 Corrección funcional]
    P1 --> P2[P2 Pruebas y mantenibilidad]
    P2 --> P3[P3 Rendimiento y UX]
```

## P0 — Seguridad y privacidad

### SEC-01. Rotar y retirar las contraseñas publicadas

**Evidencia:** el workflow inyecta `VITE_ADMIN_PASSWORD`, `VITE_USUARIO_PASSWORD` y `VITE_READONLY_PASSWORD`; `FirebaseLogin` contiene `fillCredentials`, que las referencia aunque ya no esté conectado a la interfaz. Una comprobación exacta —sin imprimir los valores— confirmó que los tres emails y las tres contraseñas de `.env.local` aparecen literalmente en `dist/assets/index-DfByffBc.js`. Las variables `VITE_*` están destinadas al bundle del navegador y no deben considerarse secretas.

**Acción inmediata:** rotar las tres contraseñas, retirar esos valores del build y eliminar `fillCredentials`. Firebase Auth debe validar credenciales introducidas por el usuario; los secretos administrativos deben permanecer fuera del cliente.

### SEC-02. Versionar y desplegar reglas de Firestore y Storage

**Evidencia:** no existen `firestore.rules`, `storage.rules` ni configuración de reglas en `firebase.json`. El cliente asigna y filtra por `userId`; sin reglas versionadas no puede comprobarse que el backend impida suplantarlo o modificarlo.

**Acción:** definir reglas que validen autenticación, propiedad, campos admitidos y permisos por rol; añadir pruebas con Firebase Emulator y desplegar reglas junto con Hosting.

### SEC-03. Aplicar autorización real por rol

**Evidencia:** `admin`, `full` y `readonly` solo se muestran en la cabecera. Formularios, edición, pago, carga y eliminación no comprueban el rol.

**Acción:** mantener roles en custom claims o documentos protegidos, ocultar/deshabilitar acciones y, sobre todo, hacer que las reglas rechacen escrituras no autorizadas.

### SEC-04. Proteger el modo local y los datos sensibles

**Evidencia:** el modo local usa usuarios fijos y una contraseña literal hardcodeada en `AuthContext.tsx`. `StatsView` imprime muestras con nombres y DNI en consola, y `ErrorBoundary` muestra el stack al usuario. El valor de esa contraseña no se reproduce en esta documentación.

**Acción:** declarar el modo local como demo solo para desarrollo o eliminarlo de producción; retirar logs con PII y mostrar un error genérico con un identificador de soporte.

## P1 — Integridad y corrección funcional

### DATA-01. Unificar el manejo de fechas

**Evidencia:** varias vistas usan `new Date("YYYY-MM-DD")`, mientras otras usan `parseLocalDate`. En Lima, la primera forma interpreta UTC y puede desplazar día o mes. `fechaRegistro` usa `toISOString()` y el reloj del navegador.

**Afecta:** paneles, `StatsView`, `ProjectionView` y generación de cronogramas.

**Acción:** centralizar un tipo de fecha civil, usar `parseLocalDate` de forma consistente y timestamps de servidor para auditoría. Añadir pruebas en límites de mes/año y zona `America/Lima`.

### DATA-02. Calcular mora con la fecha efectiva de pago

**Evidencia:** `markCuotaAsPaid` recibe `fechaPago`, pero `calculateMora` siempre compara contra hoy. Un pago histórico registrado después acumula mora hasta la fecha de digitación.

**Acción:** parametrizar la fecha de cálculo y conservar explícitamente la regla de negocio aplicada.

### DATA-03. Evitar escrituras perdidas y duplicados concurrentes

**Evidencia:** cada cambio reemplaza `cuotas` completo desde una copia local. La unicidad manzana+lote se comprueba leyendo todos los documentos y no es atómica.

**Acción:** usar transacciones/versiones o una subcolección de cuotas; persistir una clave normalizada única para el lote y crearla de forma transaccional.

### DATA-04. Borrar Storage de forma realmente recursiva

**Evidencia:** las cargas viven en `clients/{id}/cuotas/{índice}/archivo`, pero `deleteClient` solo lista la raíz y un nivel adicional. Los objetos bajo cada índice pueden quedar huérfanos.

**Acción:** borrar por prefijo desde un entorno servidor confiable o implementar recorrido recursivo completo y verificar el resultado antes de confirmar la eliminación.

### DATA-05. Propagar errores de mutación

**Evidencia:** varias funciones Firebase capturan el error y resuelven sin lanzarlo. Algunos manejadores no esperan la promesa y muestran éxito inmediatamente (`deleteClient`, marcar pagada, varias ediciones).

**Acción:** devolver un resultado tipado o relanzar; hacer `await` en la UI y notificar éxito solo después de la confirmación.

### DATA-06. Corregir totales con mora indefinida

**Evidencia:** `updateCuotaAmount` suma `newAmount + cuota.mora` sin valor por defecto, aunque las cuotas nuevas omiten `mora`. El resultado puede ser `NaN`.

**Acción:** usar `mora ?? 0`, validar todos los importes antes de persistir y probar la conciliación final. También debe impedirse que el monto regular deje negativa la última cuota; truncarla a cero, como hace una edición individual, rompe la igualdad con el monto contractual.

### DATA-07. Validar invariantes y detener regeneraciones vacías

**Evidencia:** los formularios solo comprueban que `numeroCuotas` sea una cadena no vacía, por lo que aceptan `0`; tampoco garantizan importes positivos, número entero ni `inicial <= montoTotal`. Un cliente sin inicial y con cero cuotas produce `cuotas: []`. El listener interpreta el arreglo vacío como pendiente de generación, vuelve a escribirlo vacío y puede mantener un ciclo de snapshots y escrituras.

**Acción:** validar el formulario y el dato persistido con un esquema compartido, operar importes en centavos o decimal, y guardar un estado/versionado explícito de generación en lugar de inferirlo de `cuotas.length`.

### DATA-08. Auditar cambios de migración

**Evidencia:** la configuración conserva `migracionActualizadaEn`, pero no registra quién activó, cambió el corte, desactivó o ejecutó la actualización oficial, ni mantiene un historial de versiones anteriores. La marca temporal proviene del navegador.

**Acción:** registrar cada cambio en una bitácora inmutable con UID, fecha de servidor, valores anterior/nuevo y motivo; protegerla con reglas y ofrecer trazabilidad desde el detalle del cliente. Mantener la escritura de configuración separada de `cuotas`.

### FUNC-01. Decidir y completar el modo local

**Evidencia:** `ProjectionView`, `StatsView` y `DelinquentClientsReport` exigen contexto Firebase; `ClientList` usa Storage en ambos modos.

**Acción:** o bien adaptar todas las vistas a una interfaz de repositorio común y almacenamiento local de adjuntos, o retirar el selector local de producción.

### FUNC-02. Unificar la semántica de ventas al contado

**Evidencia:** los formularios exigen `numeroCuotas` y el generador puede crear cuotas para contado. Otros cálculos consideran una venta al contado totalmente pagada y el reporte mensual reconoce todo el contrato como ingreso sin registrar un pago.

**Acción:** acordar el modelo contable y representar el pago al contado como una transacción explícita o como un cronograma coherente.

### FUNC-03. Revisar métricas financieras

Hallazgos concretos:

- `ProjectionView` incluye cuotas pagadas; decidir si representa contrato total o cobro futuro.
- `StatsView` puede sumar dos veces una cuota pagada anticipadamente cuando pago y vencimiento caen en el mismo mes; además atribuye al mes de vencimiento una cuota pagada en un mes posterior.
- El reporte de deudores usa `cuota.total || cuota.monto`; una cuota pendiente generada ya tiene `total = monto`, por lo que no incorpora la mora automática calculable.
- El Excel calcula una mora visible, pero prefiere el `total` persistido; como la cuota nace con `total = monto`, una misma fila puede mostrar mora y un total que no la incluye.
- `estado: "vencido"` forma parte del tipo, pero no existe transición que lo mantenga.

**Acción:** definir cada KPI, extraer cálculos puros y cubrirlos con casos de prueba aprobados por negocio.

## P2 — Pruebas, tipos y mantenibilidad

### QA-01. Incorporar una puerta de calidad en CI

Comprobaciones realizadas durante este análisis:

- `npm run lint`: **59 errores**.
- El script usa `--quiet` y oculta advertencias; ESLint sin esa opción informó además 15 warnings.
- `tsc --noEmit -p tsconfig.app.json`: no inicia la comprobación porque `ignoreDeprecations: "6.0"` es inválido para la versión TypeScript instalada.
- No existe script de pruebas ni pruebas de primera parte.
- El workflow despliega después de `build`, sin lint, typecheck ni tests.

**Acción:** corregir la configuración TypeScript, dejar lint/typecheck en verde y exigirlos antes del despliegue. Añadir unit tests para cronogramas, redondeo, mora, fechas y reportes; después pruebas del contexto con emuladores.

### QA-02. Blindar la frontera de migración

**Evidencia:** la migración introduce una frontera inclusiva y dos exportadores que deben particionar las mismas cuotas, además de una operación masiva cuyo requisito principal es no tocar pagos históricos.

**Acción:** probar al menos: alta nueva con versión vigente, `migracionElegible = false`, estado **NO APLICA** y rechazo de activación; histórico sin marcador y versión legada reconocido por fallback; persistencia de `migracionElegible = true` al guardar ese histórico; cliente no migrado; corte en 1 y en la última cuota; inicial siempre base; cuotas `N-1`, `N` y `N+1`; desactivación; partición sin pérdidas ni duplicados; coincidencia PDF/XLS; y comparación profunda de `cuotas` antes/después de una actualización masiva. En Firebase, ejecutar estos casos con Emulator y verificar que clientes nuevos, no elegibles e inactivos no reciben escrituras masivas ni se segmentan en las exportaciones.

### MAINT-01. Centralizar el modelo de dominio

**Evidencia:** los tipos de migración ya se comparten desde `src/types/paymentMigration.ts`, pero `Client`, `Cuota`, `User` y los formatos de adjunto se duplican y todavía divergen.

**Acción:** crear tipos únicos y validación de runtime —por ejemplo con Zod, ya instalado— en los límites de Firestore/localStorage.

### MAINT-02. Separar responsabilidades

**Evidencia:** `ClientList.tsx` concentra listado, detalle, migración, pagos, archivos y dos exportadores; los contextos mezclan autenticación, repositorio y reglas financieras; los dos dashboards y formularios están duplicados.

**Acción:** extraer funciones puras de fechas/mora/cronograma, un repositorio con implementaciones Firebase/local, servicios de archivos y generadores de reportes. Compartir un solo dashboard y formulario.

### MAINT-03. Endurecer TypeScript

**Evidencia:** la configuración desactiva comprobaciones estrictas y el lint detecta numerosos `any`. También existen imports no usados como `Timestamp` y `createUserWithEmailAndPassword`.

**Acción:** activar reglas de forma gradual, eliminar `any` en datos financieros y adoptar tipos discriminados para adjuntos y resultados de mutaciones.

### MAINT-04. Limpiar configuración y dependencias

- Elegir un solo gestor: `packageManager` declara pnpm, pero conviven `pnpm-lock.yaml` y `package-lock.json`.
- Retirar Supabase si seguirá sin uso.
- Retirar React Query o usarlo conscientemente; hoy solo se monta el proveedor.
- Eliminar `ModeSelector`, `Index` y `NotFound` si no formarán parte de las rutas.
- Unificar configuración Firebase: el workflow define `VITE_FIREBASE_*`, pero `services/firebase.ts` usa valores codificados. La API key web de Firebase no es por sí sola un secreto; la protección debe descansar en reglas y restricciones correctas.

### REL-01. Acotar la recuperación del listener

**Evidencia:** cualquier error de `onSnapshot` —transitorio, permisos o índice faltante— programa otro intento a los 1,5 segundos, sin clasificar el error, límite, backoff progresivo ni cancelación explícita del temporizador.

**Acción:** reintentar solo errores recuperables con backoff y jitter, cancelar el temporizador al desmontar y mostrar una condición accionable para errores permanentes.

## P3 — Rendimiento y experiencia

- Evitar leer todos los clientes para cada alta; usar clave normalizada e índice.
- Considerar subcolección de cuotas si crece el historial o hay varios operadores concurrentes.
- Cargar de forma diferida vistas y exportadores: el bundle principal del artefacto observado mide aproximadamente 1,53 MB sin comprimir y se importan jsPDF y todas las pestañas desde el arranque.
- Validar tamaño, extensión y MIME de adjuntos; mostrar progreso, reintento y eliminación individual.
- Reemplazar el `.xls` basado en HTML por un archivo XLSX real o CSV explícito.
- Añadir paginación o virtualización para carteras grandes.
- Añadir nombres accesibles a las ocho pestañas en móvil y hacer navegables con teclado las filas de búsqueda.
- Incorporar observabilidad con mensajes de usuario seguros y trazas sin PII.

## Orden de ejecución sugerido

1. Rotar credenciales publicadas; retirar contraseñas del frontend.
2. Versionar reglas Firebase, aplicar roles y cerrar filtraciones de privacidad.
3. Fechas, mora histórica, manejo de errores y limpieza de Storage.
4. Pruebas de reglas de negocio y puerta de calidad en CI.
5. Modelo de dominio común y repositorios por modo.
6. Revisión contable de métricas y ventas al contado.
7. Refactor de componentes, dependencias y experiencia de archivos.

Arquitectura actual: [[Arquitectura]]. Modelo afectado: [[Base-de-datos]]. Flujos a proteger: [[Flujos-del-sistema]].
