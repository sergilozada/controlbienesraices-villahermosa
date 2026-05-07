import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  onSnapshot,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { auth, db, storage } from '@/lib/firebase';
import { ref as storageRef, listAll, deleteObject } from 'firebase/storage';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'full' | 'readonly';
  email: string;
}

interface Client {
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
  cuotas?: Cuota[];
  userId: string; // Para asociar con el usuario
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
  firebaseUser: FirebaseUser | null;
  clients: Client[];
  selectedClientId: string | null;
  loading: boolean;
  setSelectedClientId: (id: string | null) => void;
  formatLocalISO: (date?: Date | string) => string;
  parseLocalDate: (iso: string) => Date;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'fechaRegistro' | 'cuotas' | 'userId'>) => Promise<boolean>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  generateCuotas: (clientId: string) => Promise<void>;
  updateCuota: (clientId: string, cuotaIndex: number, cuota: Partial<Cuota>) => Promise<void>;
  calculateMora: (vencimiento: string, monto: number) => number;
  searchClients: (manzana: string, lote: string, dniNombre?: string) => Client[];
  markCuotaAsPaid: (clientId: string, cuotaIndex: number, fechaPago: string) => Promise<void>;
  updateCuotaAmount: (clientId: string, newAmount: number) => Promise<void>;
  updateCuotaDates: (clientId: string, cuotaIndex: number, newDate: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.trace('FirebaseAuthContext: useAuth called without provider');
    throw new Error('useAuth (Firebase) must be used within a Firebase AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // a small key to force re-subscribing to Firestore listeners on error
  const [listenerKey, setListenerKey] = useState(0);

  // Usuarios predeterminados con emails para Firebase
  const defaultUsers: { [key: string]: Omit<User, 'id'> } = {
    'admin@bienesraices.com': { username: 'admin', role: 'admin', email: 'admin@bienesraices.com' },
    'usuario@bienesraices.com': { username: 'usuario', role: 'full', email: 'usuario@bienesraices.com' },
    'readonly@bienesraices.com': { username: 'readonly', role: 'readonly', email: 'readonly@bienesraices.com' }
  };

  // Escuchar cambios de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        // Buscar datos del usuario en los usuarios predeterminados
        const userData = defaultUsers[firebaseUser.email || ''];
        if (userData) {
          setUser({
            id: firebaseUser.uid,
            ...userData
          });
        }
      } else {
        setUser(null);
        setClients([]);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Escuchar cambios en los clientes cuando el usuario está autenticado
  useEffect(() => {
    if (!firebaseUser) {
      setClients([]);
      return;
    }

    const clientsQuery = query(
      collection(db, 'clients'),
      where('userId', '==', firebaseUser.uid),
      orderBy('fechaRegistro', 'desc')
    );

    // Subscribe with an error callback so we can handle transient network/protocol errors
    const unsubscribe = onSnapshot(clientsQuery, (snapshot) => {
      const clientsData: Client[] = [];
      snapshot.forEach((doc) => {
        clientsData.push({
          id: doc.id,
          ...doc.data()
        } as Client);
      });
      setClients(clientsData);

      // Ensure cuotas are generated for any client that doesn't have them yet (race condition fix)
      clientsData.forEach(c => {
        if (!c.cuotas || c.cuotas.length === 0) {
          // fire-and-forget; generateCuotas will fetch the client if necessary
          generateCuotas(c.id).catch(err => console.error('generateCuotas error on snapshot:', err));
        }
      });
    }, (error) => {
      // Common: net::ERR_QUIC_PROTOCOL_ERROR originates from the browser/network layer when
      // attempting HTTP/3/QUIC connections to Firestore's listen channel. It's usually transient
      // or caused by a proxy/VPN/antivirus. Log and attempt to re-subscribe after a short backoff.
      console.error('onSnapshot error (will retry):', error);
      // schedule a re-subscribe by bumping listenerKey after a short delay
      setTimeout(() => setListenerKey(k => k + 1), 1500);
    });

    return () => unsubscribe();
  }, [firebaseUser, listenerKey]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error('Error de login:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error de logout:', error);
    }
  };

  const addClient = async (clientData: Omit<Client, 'id' | 'fechaRegistro' | 'cuotas' | 'userId'>): Promise<boolean> => {
    if (!firebaseUser) return false;

    try {
      // Verificar si ya existe un cliente con la misma manzana y lote
      // Firestore equality queries are exact; to avoid issues with case/whitespace
      // and eventual consistency, fetch user's clients and compare normalized strings locally.
      const userClientsQuery = query(
        collection(db, 'clients'),
        where('userId', '==', firebaseUser.uid)
      );
      const snapshot = await getDocs(userClientsQuery);
      const normalizedNewManzana = (clientData.manzana || '').toString().trim().toLowerCase();
      const normalizedNewLote = (clientData.lote || '').toString().trim().toLowerCase();

      for (const d of snapshot.docs) {
        const data = d.data() as any;
        const man = (data.manzana || '').toString().trim().toLowerCase();
        const lot = (data.lote || '').toString().trim().toLowerCase();
        if (man === normalizedNewManzana && lot === normalizedNewLote) {
          return false; // Ya existe
        }
      }

      // Build new client object but remove any undefined fields (Firestore rejects undefined)
      const rawClient: Record<string, any> = {
        ...clientData,
        userId: firebaseUser.uid,
        fechaRegistro: new Date().toISOString().split('T')[0],
        cuotas: []
      };

      const newClient: Record<string, any> = {};
      Object.keys(rawClient).forEach((k) => {
        const v = (rawClient as any)[k];
        if (v !== undefined) newClient[k] = v;
      });

      const docRef = await addDoc(collection(db, 'clients'), newClient as any);
      
      // Generar cuotas
      setTimeout(() => generateCuotas(docRef.id), 100);
      
      return true;
    } catch (error) {
      console.error('Error al agregar cliente:', error);
      return false;
    }
  };

  const updateClient = async (id: string, clientData: Partial<Client>): Promise<void> => {
    try {
      const clientRef = doc(db, 'clients', id);
      await updateDoc(clientRef, clientData);
    } catch (error) {
      console.error('Error al actualizar cliente:', error);
    }
  };

  const deleteClient = async (id: string): Promise<void> => {
    try {
      // First delete storage files under clients/{id}/cuotas/** if any
      try {
        const listRef = storageRef(storage, `clients/${id}`);
        const res = await listAll(listRef);
        // delete files directly under this path
        await Promise.all(res.items.map(itemRef => deleteObject(itemRef).catch(err => { console.warn('Error deleting storage file', err); })));
        // listAll does not recursively list nested folders in older SDK; try to list each subfolder
        await Promise.all(res.prefixes.map(async (pref) => {
          try {
            const subRes = await listAll(pref);
            await Promise.all(subRes.items.map(it => deleteObject(it).catch(err => { console.warn('Error deleting nested file', err); })));
          } catch (e) {
            console.warn('Error listing nested prefix', e);
          }
        }));
      } catch (err) {
        console.warn('Error cleaning up storage for client', id, err);
      }

      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
    }
  };

  const getLastDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const parseLocalDate = (iso: string) => {
    if (!iso) return new Date();
    const parts = iso.toString().split('-');
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2].slice(0,2), 10);
      return new Date(y, m, d);
    }
    return new Date(iso);
  };

  const formatLocalISO = (date?: Date | string) => {
    let d: Date;
    if (!date) d = new Date();
    else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) d = parseLocalDate(date);
    else d = new Date(date as any);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const generateCuotas = async (clientId: string): Promise<void> => {
    let client = clients.find(c => c.id === clientId) as Client | undefined;

    // If client is not yet in local state (race with onSnapshot), fetch it directly from Firestore
    if (!client) {
      try {
        const clientDoc = await getDoc(doc(db, 'clients', clientId));
        if (clientDoc.exists()) {
          client = { id: clientDoc.id, ...(clientDoc.data() as any) } as Client;
        }
      } catch (err) {
        console.error('Error fetching client for generateCuotas:', err);
      }
    }

    if (!client) return;

    try {
      const cuotas: Cuota[] = [];
      const fechaRegistro = new Date(client.fechaRegistro);
      
      // Agregar cuota inicial (número 0)
      if (client.inicial && client.inicial > 0) {
        // Do not set `mora` here so that automatic calculation applies unless user overrides it later
        cuotas.push({
          numero: 0,
          vencimiento: client.fechaRegistro,
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
          const fechaVencimiento = new Date(fechaRegistro.getFullYear(), fechaRegistro.getMonth() + i + 1, 1);
          const ultimoDia = getLastDayOfMonth(fechaVencimiento.getFullYear(), fechaVencimiento.getMonth());
          fechaVencimiento.setDate(ultimoDia);
          
          const esUltimaCuota = i === client.numeroCuotas - 1;
          const monto = esUltimaCuota ? 
            montoFinanciar - (montoCuota * (client.numeroCuotas - 1)) : 
            montoCuota;
          
          // Do not set `mora` on generated cuotas so the UI will calculate mora dynamically
          cuotas.push({
            numero: i + 1,
            vencimiento: formatLocalISO(fechaVencimiento),
            monto: monto,
            total: monto,
            estado: 'pendiente'
          } as any);
        }
      }
      
      await updateClient(clientId, { cuotas });
    } catch (error) {
      console.error('Error al generar cuotas:', error);
    }
  };

  const updateCuota = async (clientId: string, cuotaIndex: number, cuotaData: Partial<Cuota>): Promise<void> => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !client.cuotas) return;

    try {
      const updatedCuotas = [...client.cuotas];
      updatedCuotas[cuotaIndex] = { ...updatedCuotas[cuotaIndex], ...cuotaData };
      
      await updateClient(clientId, { cuotas: updatedCuotas });
    } catch (error) {
      console.error('Error al actualizar cuota:', error);
    }
  };

  const markCuotaAsPaid = async (clientId: string, cuotaIndex: number, fechaPago: string): Promise<void> => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !client.cuotas) return;

    try {
      const updatedCuotas = [...client.cuotas];
      const cuota = updatedCuotas[cuotaIndex];
      
    let mora = 0;
    if (cuota.numero === 0) mora = 0;
    // If mora was manually set (manualMora === true) prefer that value (even 0); otherwise calculate it
    else if (typeof cuota.mora === 'number' && (cuota as any).manualMora === true) mora = cuota.mora;
    else mora = calculateMora(cuota.vencimiento, cuota.monto);

      const fechaPagoISO = formatLocalISO(fechaPago);

      updatedCuotas[cuotaIndex] = {
        ...cuota,
        fechaPago: fechaPagoISO,
        estado: 'pagado',
        mora,
        total: cuota.monto + mora
      };
      
      await updateClient(clientId, { cuotas: updatedCuotas });
    } catch (error) {
      console.error('Error al marcar cuota como pagada:', error);
    }
  };

  const updateCuotaAmount = async (clientId: string, newAmount: number): Promise<void> => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !client.cuotas) return;

    try {
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
      
      await updateClient(clientId, { cuotas });
    } catch (error) {
      console.error('Error al actualizar montos de cuotas:', error);
    }
  };

  const updateCuotaDates = async (clientId: string, cuotaIndex: number, newDate: string): Promise<void> => {
    await updateCuota(clientId, cuotaIndex, { vencimiento: newDate });
  };

  const calculateMora = (vencimiento: string, monto: number): number => {
    const fechaVencimiento = parseLocalDate(vencimiento);
    const hoy = new Date();
    const diffTime = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() - new Date(fechaVencimiento.getFullYear(), fechaVencimiento.getMonth(), fechaVencimiento.getDate()).getTime();
    const diasVencidos = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diasVencidos <= 5) return 0;
    
    let porcentajeMora = 0;
    
    if (diasVencidos <= 14) {
      porcentajeMora = (diasVencidos - 5) * 0.01;
    } else {
      porcentajeMora += 9 * 0.01;
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
      firebaseUser,
      clients,
      selectedClientId,
      loading,
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
      updateCuotaDates
    }}>
      {children}
    </AuthContext.Provider>
  );
};