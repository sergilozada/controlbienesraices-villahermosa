import React, { createContext, useContext, useState, useEffect } from 'react';
import { CURRENT_PAYMENT_SCHEDULE_VERSION } from '@/config/paymentSchedule';
import type { ClientMigrationFields, ClientMigrationState } from '@/types/paymentMigration';
import { isLegacyMigrationEligible, isMigrationEnabled } from '@/types/paymentMigration';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'full' | 'readonly';
}

interface Client extends ClientMigrationFields {
  id: string;
  nombre1: string;
  nombre2?: string;
  dni1: string;
  dni2?: string;
  celular1?: string;
  celular2?: string;
  email1?: string;
  email2?: string;
  manzana: string;
  lote: string;
  metraje: number;
  montoTotal: number;
  formaPago: 'contado' | 'cuotas';
  inicial?: number;
  numeroCuotas?: number;
  fechaRegistro: string;
  versionCronograma?: string;
  cuotas?: Cuota[];
}

interface Cuota {
  numero: number;
  vencimiento: string;
  monto: number;
  mora?: number;
  total?: number;
  manualMora?: boolean;
  fechaPago?: string;
  estado: 'pendiente' | 'pagado' | 'vencido';
  voucher?: string | string[];
  boleta?: string | string[];
}

interface AuthContextType {
  user: User | null;
  clients: Client[];
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  formatLocalISO: (date?: Date | string) => string;
  parseLocalDate: (iso: string) => Date;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addClient: (client: Omit<Client, 'id' | 'fechaRegistro' | 'cuotas'>) => boolean;
  updateClient: (id: string, client: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  generateCuotas: (clientId: string) => void;
  updateCuota: (clientId: string, cuotaIndex: number, cuota: Partial<Cuota>) => void;
  calculateMora: (vencimiento: string, monto: number) => number;
  searchClients: (manzana: string, lote: string, dniNombre?: string) => Client[];
  markCuotaAsPaid: (clientId: string, cuotaIndex: number, fechaPago: string) => void;
  updateCuotaAmount: (clientId: string, newAmount: number) => void;
  updateCuotaDates: (clientId: string, cuotaIndex: number, newDate: string) => void;
  updateClientMigration: (clientId: string, migration: ClientMigrationState) => Promise<void>;
  updateMigratedClientsSchedule: (targetVersion: string) => Promise<number>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.trace('AuthContext: useAuth called without provider');
    throw new Error('useAuth (Local) must be used within a Local AuthProvider');
  }
  return context;
};

export const useOptionalAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Usuarios predeterminados (en producción esto vendría de Firebase)
  const defaultUsers: { [key: string]: User } = {
    'admin': { id: '1', username: 'admin', role: 'admin' },
    'usuario': { id: '2', username: 'usuario', role: 'full' },
    'readonly': { id: '3', username: 'readonly', role: 'readonly' }
  };

  useEffect(() => {
    // Cargar datos del localStorage
    const savedUser = localStorage.getItem('currentUser');
    const savedClients = localStorage.getItem('clients');
    
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    if (savedClients) {
      setClients(JSON.parse(savedClients));
    }
    
    // No auto-login: requerir credenciales explícitas
  }, []);

  useEffect(() => {
    // Guardar clientes en localStorage
    localStorage.setItem('clients', JSON.stringify(clients));
  }, [clients]);

  const login = (username: string, password: string): boolean => {
    // Validación simple (en producción usar Firebase Auth)
    if (defaultUsers[username] && password === 'password123') {
      const loggedUser = defaultUsers[username];
      setUser(loggedUser);
      localStorage.setItem('currentUser', JSON.stringify(loggedUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const addClient = (clientData: Omit<Client, 'id' | 'fechaRegistro' | 'cuotas'>): boolean => {
    // Verificar si ya existe un cliente con la misma manzana y lote
    const existingClient = clients.find(client => 
      client.manzana.toLowerCase() === clientData.manzana.toLowerCase() && 
      client.lote.toLowerCase() === clientData.lote.toLowerCase()
    );
    
    if (existingClient) {
      return false; // No permitir duplicados
    }

    const newClient: Client = {
      ...clientData,
      id: Date.now().toString(),
      fechaRegistro: new Date().toISOString().split('T')[0],
      versionCronograma: CURRENT_PAYMENT_SCHEDULE_VERSION,
      migracionElegible: false,
      migracionActiva: false,
      cuotas: []
    };
    
    setClients(prev => [...prev, newClient]);
    
    // Generar cuotas para ambos tipos de pago (contado y cuotas)
    setTimeout(() => generateCuotas(newClient.id), 100);
    
    return true;
  };

  const updateClient = (id: string, clientData: Partial<Client>) => {
    const safeClientData = { ...clientData };
    delete safeClientData.versionCronograma;
    delete safeClientData.migracionElegible;
    delete safeClientData.migracionActiva;
    delete safeClientData.migracionDesdeCuota;
    delete safeClientData.versionCronogramaMigracion;
    delete safeClientData.migracionActualizadaEn;

    setClients(prev => prev.map(client => 
      client.id === id ? { ...client, ...safeClientData } : client
    ));
  };

  const deleteClient = (id: string) => {
    setClients(prev => prev.filter(client => client.id !== id));
  };

  const getLastDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };
  const parseLocalDate = (iso: string) => {
    // iso expected 'YYYY-MM-DD' or any date-like, parse as local date to avoid timezone shifts
    if (!iso) return new Date();
    const parts = iso.toString().split('-');
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2].slice(0,2), 10);
      return new Date(y, m, d);
    }
    // Fallback to Date constructor
    return new Date(iso);
  };

  const formatLocalISO = (date?: Date | string) => {
    // Accept either a Date or a 'YYYY-MM-DD' string and return 'YYYY-MM-DD' without timezone shifts
    let d: Date;
    if (!date) d = new Date();
    else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) d = parseLocalDate(date);
    else d = new Date(date as any);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const generateCuotas = (clientId: string) => {
    setClients(prev => prev.map(client => {
      if (client.id === clientId) {
        const cuotas: Cuota[] = [];
        const fechaRegistro = new Date(client.fechaRegistro);
        
        // Agregar cuota inicial (número 0)
        if (client.inicial && client.inicial > 0) {
          // Don't set `mora` so calculateMora will apply unless user overrides later
          cuotas.push({
            numero: 0,
            vencimiento: client.fechaRegistro, // La inicial vence el mismo día del registro
            monto: client.inicial,
            total: client.inicial,
            estado: 'pendiente'
          } as any);
        }

        // Generar cuotas mensuales
        if (client.numeroCuotas && client.numeroCuotas > 0) {
          const montoFinanciar = client.montoTotal - (client.inicial || 0);
          const montoCuota = Math.floor((montoFinanciar / client.numeroCuotas) * 100) / 100;
          
          for (let i = 0; i < client.numeroCuotas; i++) {
            // Calcular fecha de vencimiento: último día del mes siguiente
              const fechaVencimiento = new Date(fechaRegistro.getFullYear(), fechaRegistro.getMonth() + i + 1, 1);
              const ultimoDia = getLastDayOfMonth(fechaVencimiento.getFullYear(), fechaVencimiento.getMonth());
              fechaVencimiento.setDate(ultimoDia);
            
            const esUltimaCuota = i === client.numeroCuotas - 1;
            const monto = esUltimaCuota ? 
              montoFinanciar - (montoCuota * (client.numeroCuotas - 1)) : 
              montoCuota;
            
            // don't set mora so that the UI calculates mora automatically until a manual value is set
            cuotas.push({
              numero: i + 1,
              vencimiento: formatLocalISO(fechaVencimiento),
              monto: monto,
              total: monto,
              estado: 'pendiente'
            } as any);
          }
        }
        
        return { ...client, cuotas };
      }
      return client;
    }));
  };

  const updateCuota = (clientId: string, cuotaIndex: number, cuotaData: Partial<Cuota>) => {
    setClients(prev => prev.map(client => {
      if (client.id === clientId && client.cuotas) {
        const updatedCuotas = [...client.cuotas];
        updatedCuotas[cuotaIndex] = { ...updatedCuotas[cuotaIndex], ...cuotaData };
        return { ...client, cuotas: updatedCuotas };
      }
      return client;
    }));
  };

  const markCuotaAsPaid = (clientId: string, cuotaIndex: number, fechaPago: string) => {
    setClients(prev => prev.map(client => {
      if (client.id === clientId && client.cuotas) {
        const updatedCuotas = [...client.cuotas];
        const cuota = updatedCuotas[cuotaIndex];
        // Para iniciales no hay mora
        // Preferir mora manual si la cuota ya tiene un valor de mora > 0
    let mora = 0;
    if (cuota.numero === 0) mora = 0;
    // Preferir mora manual solo si fue marcada como manual (manualMora === true)
    else if (typeof cuota.mora === 'number' && (cuota as any).manualMora === true) mora = cuota.mora;
    else mora = calculateMora(cuota.vencimiento, cuota.monto);

        // Guardar fecha de pago como ISO local para evitar desfases
        const fechaPagoISO = formatLocalISO(fechaPago);

        updatedCuotas[cuotaIndex] = {
          ...cuota,
          fechaPago: fechaPagoISO,
          estado: 'pagado',
          mora,
          total: cuota.monto + mora
        };
        return { ...client, cuotas: updatedCuotas };
      }
      return client;
    }));
  };

  const updateCuotaAmount = (clientId: string, newAmount: number) => {
    setClients(prev => prev.map(client => {
      if (client.id === clientId && client.cuotas) {
        const cuotas = [...client.cuotas];
        const numeroCuotas = cuotas.filter(c => c.numero > 0).length;
        
        // Actualizar todas las cuotas excepto la última y la inicial
        for (let i = 0; i < cuotas.length; i++) {
          if (cuotas[i].numero > 0 && cuotas[i].numero < numeroCuotas) {
            cuotas[i].monto = newAmount;
            cuotas[i].total = newAmount + cuotas[i].mora;
          }
        }
        
        // Calcular monto de la última cuota
        if (numeroCuotas > 0) {
          const montoFinanciar = client.montoTotal - (client.inicial || 0);
          const montoUltimasCuotas = newAmount * (numeroCuotas - 1);
          const montoUltimaCuota = montoFinanciar - montoUltimasCuotas;
          
          const ultimaCuotaIndex = cuotas.findIndex(c => c.numero === numeroCuotas);
          if (ultimaCuotaIndex !== -1) {
            cuotas[ultimaCuotaIndex].monto = montoUltimaCuota;
            cuotas[ultimaCuotaIndex].total = montoUltimaCuota + cuotas[ultimaCuotaIndex].mora;
          }
        }
        
        return { ...client, cuotas };
      }
      return client;
    }));
  };

  const updateCuotaDates = (clientId: string, cuotaIndex: number, newDate: string) => {
    updateCuota(clientId, cuotaIndex, { vencimiento: newDate });
  };

  const updateClientMigration = async (clientId: string, migration: ClientMigrationState): Promise<void> => {
    const normalizedMigrationVersion = migration.versionCronogramaMigracion.trim();
    if (
      !Number.isInteger(migration.migracionDesdeCuota) ||
      migration.migracionDesdeCuota <= 0 ||
      !normalizedMigrationVersion
    ) {
      throw new Error('La configuración de migración no es válida.');
    }

    const clientToUpdate = clients.find(client => client.id === clientId);
    if (!clientToUpdate) {
      throw new Error('El cliente no existe.');
    }
    if (!isLegacyMigrationEligible(clientToUpdate, CURRENT_PAYMENT_SCHEDULE_VERSION)) {
      throw new Error('Los clientes nuevos no requieren ni admiten migración.');
    }
    if (
      clientToUpdate.migracionActiva === true &&
      migration.migracionActiva === true &&
      clientToUpdate.migracionDesdeCuota !== migration.migracionDesdeCuota
    ) {
      throw new Error('Desactive la migración antes de cambiar la cuota de inicio.');
    }

    setClients(prev => prev.map(client => (
      client.id === clientId
        ? {
            ...client,
            migracionElegible: true,
            migracionActiva: migration.migracionActiva,
            migracionDesdeCuota: migration.migracionDesdeCuota,
            versionCronogramaMigracion: normalizedMigrationVersion,
            migracionActualizadaEn: migration.migracionActualizadaEn
          }
        : client
    )));
  };

  const updateMigratedClientsSchedule = async (targetVersion: string): Promise<number> => {
    const normalizedTargetVersion = targetVersion.trim();
    if (!normalizedTargetVersion) {
      throw new Error('La versión del cronograma oficial no puede estar vacía.');
    }

    const migratedCount = clients.filter(client => (
      isMigrationEnabled(client, CURRENT_PAYMENT_SCHEDULE_VERSION)
    )).length;
    if (migratedCount === 0) return 0;

    const updatedAt = new Date().toISOString();
    setClients(prev => prev.map(client => (
      isMigrationEnabled(client, CURRENT_PAYMENT_SCHEDULE_VERSION)
        ? {
            ...client,
            migracionElegible: true,
            versionCronogramaMigracion: normalizedTargetVersion,
            migracionActualizadaEn: updatedAt
          }
        : client
    )));

    return migratedCount;
  };

  const calculateMora = (vencimiento: string, monto: number): number => {
    const fechaVencimiento = parseLocalDate(vencimiento);
    const hoy = new Date();
    // calcular diferencia en días usando UTC midnight diff on local dates
    const diffTime = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() - new Date(fechaVencimiento.getFullYear(), fechaVencimiento.getMonth(), fechaVencimiento.getDate()).getTime();
    const diasVencidos = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diasVencidos <= 5) return 0;
    
    let porcentajeMora = 0;
    
    // Del día 6 al 14: 1% diario
    if (diasVencidos <= 14) {
      porcentajeMora = (diasVencidos - 5) * 0.01;
    } else {
      // Días 6-14: 1% diario
      porcentajeMora += 9 * 0.01; // 9 días al 1%
      // Día 15 en adelante: 1.5% diario
      porcentajeMora += (diasVencidos - 14) * 0.015;
    }
    
    return monto * porcentajeMora;
  };

  const searchClients = (manzana: string, lote: string, dniNombre?: string): Client[] => {
    return clients.filter(client => {
      const matchManzana = !manzana || client.manzana.toLowerCase().includes(manzana.toLowerCase());
      const matchLote = !lote || client.lote.toLowerCase().includes(lote.toLowerCase());
      const matchDniNombre = !dniNombre || 
        client.dni1.includes(dniNombre) ||
        client.nombre1.toLowerCase().includes(dniNombre.toLowerCase()) ||
        (client.nombre2 && client.nombre2.toLowerCase().includes(dniNombre.toLowerCase()));
      
      return matchManzana && matchLote && matchDniNombre;
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      clients,
      selectedClientId,
      setSelectedClientId,
      formatLocalISO,
      parseLocalDate,
      login,
      logout,
      addClient,
      updateClient,
      deleteClient,
      generateCuotas,
      updateCuota,
      calculateMora,
      searchClients,
      markCuotaAsPaid,
      updateCuotaAmount,
      updateCuotaDates,
      updateClientMigration,
      updateMigratedClientsSchedule
    }}>
      {children}
    </AuthContext.Provider>
  );
};
