---
tags:
  - flujos
  - secuencias
  - operacion
actualizado: 2026-08-21
---

# Flujos del sistema

[[Inicio|← Inicio]] · [[Arquitectura]] · [[Funciones-principales]] · [[Base-de-datos]] · [[Mejoras-pendientes]]

## 1. Inicio y autenticación Firebase

`/` y cualquier ruta desconocida montan el proveedor Firebase. La pantalla espera a `onAuthStateChanged`; sin una sesión reconocida muestra `FirebaseLogin`. Tras autenticar, el contexto abre una suscripción a clientes del UID, pero solo crea el perfil interno si el email figura en el mapa fijo `defaultUsers`. Un usuario válido de Firebase con otro email conserva `user = null` y sigue viendo el login aunque el listener pueda estar activo.

```mermaid
sequenceDiagram
    actor O as Operador
    participant UI as App / FirebaseLogin
    participant C as FirebaseAuthContext
    participant A as Firebase Auth
    participant D as Firestore

    UI->>C: Montar proveedor
    C->>A: onAuthStateChanged()
    alt No existe sesión
        C-->>UI: user = null
        O->>UI: Email y contraseña
        UI->>C: login(email, password)
        C->>A: signInWithEmailAndPassword()
    end
    A-->>C: FirebaseUser
    C->>C: Buscar email en defaultUsers
    C->>D: onSnapshot(clients por userId y fechaRegistro)
    D-->>C: Clientes del UID
    alt Email reconocido
        C-->>UI: Perfil interno y dashboard
    else Email no reconocido
        C-->>UI: user = null y mantener login
    end
```

Si el listener falla, el contexto incrementa `listenerKey` tras 1,5 segundos y vuelve a suscribirse.

## 2. Registro de cliente y cronograma

```mermaid
flowchart TD
    A[Nuevo registro] --> B{Formulario válido}
    B -- No --> C[Notificación de error]
    B -- Sí --> D[Consultar clientes del UID]
    D --> E{Misma manzana y lote}
    E -- Sí --> F[Rechazar duplicado]
    E -- No --> G[Asignar versión vigente]
    G --> NE[migracionElegible false y migracionActiva false]
    NE --> AD[addDoc con cuotas vacías]
    AD --> H[generateCuotas]
    H --> I{Inicial mayor que cero}
    I -- Sí --> J[Crear cuota 0]
    I -- No --> K[Continuar]
    J --> K
    K --> L[Dividir saldo en N cuotas]
    L --> M[Vencimientos al fin de cada mes]
    M --> N[Residuo en la última cuota]
    N --> O[updateDoc del arreglo cuotas]
    O --> P[onSnapshot actualiza la interfaz]
```

Hay dos disparadores posibles para la generación: un temporizador de 100 ms después del alta y el listener, que detecta documentos con `cuotas` vacío. `generateCuotas` busca primero el cliente en estado y, si aún no llegó, usa `getDoc`. Toda alta de este flujo queda fuera de migración y usa directamente el cronograma vigente.

## 3. Búsqueda y apertura del detalle

1. `Dashboard` busca sobre `clients` ya cargado; no consulta Firestore por cada búsqueda.
2. Los filtros de manzana y lote aceptan coincidencias parciales.
3. El tercer filtro examina `dni1`, `nombre1` y `nombre2`.
4. Al seleccionar una fila, el panel guarda `selectedClientId` y cambia a la pestaña Clientes.
5. `ClientList` abre el detalle y cronograma correspondiente.

## 4. Edición y pago de una cuota

```mermaid
sequenceDiagram
    actor O as Operador
    participant L as ClientList
    participant C as Contexto
    participant D as Firestore o localStorage

    O->>L: Elegir fecha y marcar pagada
    L->>C: markCuotaAsPaid(cliente, índice, fecha)
    C->>C: Copiar arreglo de cuotas
    alt Es inicial
        C->>C: mora = 0
    else Existe mora manual
        C->>C: Conservar mora
    else Mora automática
        C->>C: calculateMora(vencimiento, monto)
    end
    C->>C: estado = pagado y total = monto + mora
    C->>D: Persistir arreglo completo
    D-->>L: Estado actualizado
```

La edición de monto individual mueve la diferencia a la última cuota. La edición masiva fija un nuevo monto regular y deja el saldo residual en la última. Un vencimiento puede modificarse solo o propagarse a los meses siguientes.

## 5. Carga de voucher o boleta

```mermaid
sequenceDiagram
    actor O as Operador
    participant L as ClientList
    participant S as Firebase Storage
    participant C as Contexto
    participant D as Firestore

    O->>L: Seleccionar imágenes o PDF
    loop Cada archivo
        L->>S: uploadBytes(ruta única)
        S-->>L: Referencia almacenada
        L->>S: getDownloadURL()
        S-->>L: URL
    end
    L->>L: Unir referencias anteriores y nuevas
    L->>C: updateCuota(voucher o boleta)
    C->>D: updateDoc con cuotas completas
    D-->>C: onSnapshot
    C-->>L: Mostrar referencias actualizadas
```

La ruta física es `clients/{clientId}/cuotas/{cuotaIndex}/{archivoUnico}`. La cuota guarda URL y nombre original; véase [[Base-de-datos#Firebase Storage]].

Vouchers y boletas llegan a este flujo como archivos adjuntos. No se generan como documentos empresariales dentro de la aplicación y la migración no modifica su contenido ni sus referencias.

## 6. Migración individual y actualización oficial

### Activación, corte y desactivación

```mermaid
flowchart TD
    A[Detalle de Cuotas] --> E{Cliente histórico elegible}
    E -- No --> NA[Mostrar NO APLICA · cronograma vigente]
    E -- Sí --> B{Migración activa}
    B -- No --> C[Activar migración]
    C --> D[Proponer primera cuota regular no pagada]
    D --> E[Elegir cuota N con el deslizador]
    E --> F[updateClientMigration]
    F --> G[Guardar elegible true, activa, corte, versión y fecha]
    B -- Sí --> H[Mostrar estado ACTIVADA y cuota N]
    H --> I{Solicitar desactivación}
    I --> J[Diálogo de confirmación]
    J -- Cancelar --> H
    J -- Confirmar --> K[Guardar migracionActiva false]
```

El marcador explícito `migracionElegible` prevalece. Solo para documentos históricos sin marcador se aplica el fallback `versionCronograma !== CURRENT_PAYMENT_SCHEDULE_VERSION`; el primer guardado consolida `migracionElegible = true`. Un cliente nuevo tiene el marcador en `false`, no puede activar la función y muestra **NO APLICA**.

Para históricos elegibles, el corte es inclusivo: al seleccionar la cuota `N`, las cuotas regulares menores conservan `versionCronograma`, mientras `N` y las posteriores usan `versionCronogramaMigracion`. La inicial (`numero = 0`) conserva siempre la configuración base. Mientras la migración no esté activa, el cliente funciona como antes.

### Actualización masiva al cronograma oficial

```mermaid
sequenceDiagram
    actor O as Operador
    participant L as ClientList
    participant C as Contexto
    participant D as Firestore o localStorage

    O->>L: Actualizar cronograma de migrados
    L->>L: Pedir confirmación
    O->>L: Confirmar actualización
    L->>C: updateMigratedClientsSchedule(versión oficial)
    C->>C: Filtrar histórico elegible e isMigrationEnabled(cliente)
    C->>D: Escribir versión objetivo y fecha
    Note over C,D: No incluir el arreglo cuotas
    D-->>L: Cantidad de clientes actualizados
```

Los clientes nuevos, desactivados o con metadatos incompletos quedan fuera. En Firebase las escrituras se fraccionan en lotes para no exceder el límite operativo. Como la mutación solo contiene `versionCronogramaMigracion` y `migracionActualizadaEn`, conserva fechas y montos de pago, estados, mora, totales, vouchers, boletas y cualquier otro dato de `cuotas`. Tampoco recalcula vencimientos o importes: actualiza la versión oficial de presentación/cobranza aplicada desde el corte.

Véanse la regla completa en [[Funciones-principales#Migración por cliente]] y los campos en [[Base-de-datos#Semántica de migración]].

## 7. Eliminación de cliente

```mermaid
flowchart LR
    A[Confirmación del operador] --> B[Listar clients/clientId en Storage]
    B --> C[Intentar borrar objetos encontrados]
    C --> D[deleteDoc en clients]
    D --> E[onSnapshot retira el cliente]
```

La implementación intenta limpiar Storage antes de Firestore, pero solo recorre la raíz y un nivel adicional; los archivos reales están un nivel más profundo, bajo `cuotas/{cuotaIndex}`. Este hallazgo está priorizado en [[Mejoras-pendientes]].

## 8. Informes

```mermaid
flowchart TD
    S[clients en memoria] --> P[Proyección por vencimientos]
    S --> E[Estadísticas de pagos]
    S --> MONTHLY[Reporte mensual de altas]
    S --> D[Reporte de deudores]
    S --> G[Reporte general de clientes]
    S --> C[Cronograma individual]
    C --> ELIG{Histórico elegible}
    ELIG -- No --> CURRENT[Una sección vigente · NO APLICA]
    ELIG -- Sí --> R{Migración activa}
    R -- No --> U[Una configuración histórica]
    R -- Sí --> B[Sección base: inicial y cuotas menores a N]
    R -- Sí --> MIGSEC[Sección migrada: cuota N en adelante]
    P --> PDF[PDF en navegador]
    E --> PDF
    MONTHLY --> PDF
    D --> PDF
    G --> PDF
    CURRENT --> PDF
    U --> PDF
    B --> PDF
    MIGSEC --> PDF
    CURRENT --> XLS[HTML descargado como XLS]
    U --> XLS
    B --> XLS
    MIGSEC --> XLS
```

No se guardan reportes ni agregados en la base de datos. Todo se calcula y descarga desde el navegador. Un cliente nuevo queda excluido de la partición y genera una sola sección vigente. En un cliente histórico migrado, las dos secciones conservan las filas y el formato tabular, pero cada una resuelve sus logos, proyecto, cobranza y datos bancarios con la versión que corresponde.

## 9. Modo local

Desde `/welcome`, el operador puede elegir modo local:

1. `LocalAuthProvider` restaura `currentUser` y `clients` desde `localStorage`.
2. `Login` valida usuario y contraseña dentro del frontend.
3. Las mutaciones cambian estado React y el efecto persiste `clients`.
4. La lógica de cronograma y mora replica la del contexto Firebase.

> [!caution] Limitación actual
> Proyecciones, estadísticas y deudores requieren directamente `FirebaseAuthContext`, y los adjuntos de `ClientList` siguen usando Firebase Storage. El flujo local completo no está aislado ni funciona de manera homogénea.

## Reglas transversales

- Las cuotas regulares tienen `numero > 0`; la inicial es `0`.
- Las fechas se almacenan como `YYYY-MM-DD`.
- Las mutaciones Firebase se reflejan de vuelta mediante `onSnapshot`.
- Los roles se muestran en el encabezado, pero no alteran estos flujos.
- Las operaciones sobre cuotas reemplazan el arreglo completo del cliente.
- Las operaciones de configuración de migración son la excepción: escriben solo metadatos del cliente y no reemplazan `cuotas`.

Modelo persistido: [[Base-de-datos]]. Reglas de cálculo: [[Funciones-principales]].
