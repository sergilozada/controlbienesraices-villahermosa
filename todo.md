# Sistema de Gestión de Bienes Raíces - Plan de Desarrollo

## Funcionalidades Principales
1. **Sistema de Autenticación**
   - Login con usuario y contraseña
   - Gestión de roles (Admin, Usuario completo, Solo lectura)

2. **Dashboard Principal con 8 secciones:**
   - Inicio: Búsqueda y nuevo registro
   - Clientes: Lista completa de clientes
   - Proyección: Proyección de ingresos mensuales
   - Estadísticas: Estadísticas de pagos
   - Reporte: Reportes mensuales
   - Pendientes: Cuotas que vencen este mes
   - Atrasados: Clientes con cuotas vencidas
   - Usuario: Gestión de usuarios

## Archivos a Crear (Máximo 8 archivos):

1. **src/pages/Login.tsx** - Página de login
2. **src/pages/Dashboard.tsx** - Dashboard principal con navegación
3. **src/components/ClientForm.tsx** - Formulario para nuevo registro de cliente
4. **src/components/ClientList.tsx** - Lista de clientes y gestión de cuotas
5. **src/components/ProjectionView.tsx** - Proyección de ingresos
6. **src/components/StatsView.tsx** - Estadísticas y reportes
7. **src/utils/calculations.tsx** - Funciones para cálculos de cuotas y moras
8. **src/context/AuthContext.tsx** - Contexto de autenticación y datos

## Características Técnicas:
- Zona horaria: Perú (UTC-5)
- Cálculo de moras: 1% diario días 6-14, 1.5% diario día 15+
- Vencimientos: último día de cada mes
- Almacenamiento: localStorage (preparado para Firebase)
- Moneda: Soles peruanos (S/)

## Funcionalidades de Cuotas:
- Cálculo automático: (Monto Total - Inicial) / Número de Cuotas
- Edición de montos de cuotas
- Última cuota ajustada para no descuadrar
- Gestión de pagos y estados