import { useState } from 'react';
import useAnyAuth from '@/context/useAnyAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { ArrowRightLeft, Edit, Trash2, Eye, Upload, Download, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { storage } from '@/services/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CURRENT_PAYMENT_SCHEDULE_VERSION,
  OFFICIAL_MIGRATION_SCHEDULE_VERSION
} from '@/config/paymentSchedule';
import type { ClientMigrationFields, ClientMigrationState } from '@/types/paymentMigration';
import {
  clampMigrationStart,
  getEffectiveScheduleVersion,
  getRegularInstallmentNumbers,
  getSuggestedMigrationStart,
  isLegacyMigrationEligible,
  isMigrationEnabled,
  isMigratedInstallment,
  splitInstallmentsByMigration
} from '@/types/paymentMigration';

interface ClientListProps {
  filterType?: 'pending' | 'overdue' | 'all';
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
  // If true, mora was set manually by a user and should be respected even if 0
  manualMora?: boolean;
  fechaPago?: string;
  estado: 'pendiente' | 'pagado' | 'vencido';
  // Support legacy string URLs and the newer objects that store original filename
  voucher?: string | string[] | { url: string; name?: string } | Array<{ url: string; name?: string }>;
  boleta?: string | string[] | { url: string; name?: string } | Array<{ url: string; name?: string }>;
}

interface PaymentScheduleConfig {
  displayName: string;
  logoLayout: 'legacy-wide' | 'paired-square';
  logoUrls: string[];
  cobranzaPhone: string;
  projectName: string;
  bankLines: string[];
}

const LEGACY_PAYMENT_SCHEDULE: PaymentScheduleConfig = {
  displayName: 'Configuración anterior',
  logoLayout: 'legacy-wide',
  logoUrls: ['/logo.jpeg'],
  cobranzaPhone: '942252720',
  projectName: 'VILLA HERMOSA DE CARHUAZ',
  bankLines: [
    'N° DE CUENTA BCP',
    'Soles: 38006500681006',
    'CCI: 002-3801-0650-0681-00645',
    'SEGUNDO TEOFILO LOZADA VILLEGAS'
  ]
};

const CURRENT_PAYMENT_SCHEDULE: PaymentScheduleConfig = {
  displayName: 'Nueva empresa',
  logoLayout: 'paired-square',
  logoUrls: ['/logo-ayt-house.jpeg', '/logo-condominio-villa-hermosa.jpeg'],
  cobranzaPhone: '929 074 799',
  projectName: 'Condominio Villa Hermosa',
  bankLines: [
    'N.° DE CUENTA INTERBANK',
    '4003008478638',
    'CCI',
    '00340000300847863890',
    'EMPRESA INMOBILIARIA A&T HOUSE SAC'
  ]
};

const getPaymentScheduleConfigByVersion = (version?: string): PaymentScheduleConfig => (
  version === CURRENT_PAYMENT_SCHEDULE_VERSION
    ? CURRENT_PAYMENT_SCHEDULE
    : LEGACY_PAYMENT_SCHEDULE
);

const getPaymentScheduleConfig = (client: Client, installmentNumber = 0): PaymentScheduleConfig => (
  getPaymentScheduleConfigByVersion(
    getEffectiveScheduleVersion(client, installmentNumber, CURRENT_PAYMENT_SCHEDULE_VERSION)
  )
);

const isClientMigrationEligible = (client: Client): boolean => (
  isLegacyMigrationEligible(client, CURRENT_PAYMENT_SCHEDULE_VERSION)
);

const isClientMigrationEnabled = (client: Client): boolean => (
  isMigrationEnabled(client, CURRENT_PAYMENT_SCHEDULE_VERSION)
);

const isClientMigratedInstallment = (client: Client, installmentNumber: number): boolean => (
  isMigratedInstallment(client, installmentNumber, CURRENT_PAYMENT_SCHEDULE_VERSION)
);

const getPaymentScheduleSections = (client: Client) => (
  splitInstallmentsByMigration(
    client,
    client.cuotas || [],
    CURRENT_PAYMENT_SCHEDULE_VERSION
  ).map((section) => ({
    ...section,
    config: getPaymentScheduleConfig(client, section.installments[0]?.numero ?? 0)
  }))
);

export default function ClientList({ filterType = 'all' }: ClientListProps) {
  const {
    clients,
    deleteClient,
    updateClient,
    updateCuota,
    calculateMora,
    markCuotaAsPaid,
    updateCuotaAmount,
    updateCuotaDates,
    updateClientMigration,
    updateMigratedClientsSchedule,
    selectedClientId,
    setSelectedClientId,
    formatLocalISO,
    parseLocalDate
  } = useAnyAuth();
  const [selectedClient, setSelectedClient] = useState<string | null>(selectedClientId || null);
  const [editingCuota, setEditingCuota] = useState<{ clientId: string; type: 'amount' | 'date'; cuotaIndex?: number } | null>(null);
  const [editMonto, setEditMonto] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editingMora, setEditingMora] = useState<{ clientId: string; cuotaIndex: number } | null>(null);
  const [editMoraValue, setEditMoraValue] = useState('');
  const [propagateDates, setPropagateDates] = useState(false);
  const [overdueMonth, setOverdueMonth] = useState<number | null>(null); // 0-11, null = all
  const [overdueYear, setOverdueYear] = useState<number>(new Date().getFullYear());
  // Initialize paymentDate as local ISO (yyyy-MM-dd) to avoid timezone shifts
  const [paymentDate, setPaymentDate] = useState(formatLocalISO());
  const [editingPhoneClientId, setEditingPhoneClientId] = useState<string | null>(null);
  const [editCelular1, setEditCelular1] = useState('');
  const [editCelular2, setEditCelular2] = useState('');
  const [editingEmailClientId, setEditingEmailClientId] = useState<string | null>(null);
  const [editEmail1, setEditEmail1] = useState('');
  const [editEmail2, setEditEmail2] = useState('');
  const [migrationStartDraft, setMigrationStartDraft] = useState<number | null>(null);
  const [migrationSaving, setMigrationSaving] = useState(false);
  const [bulkMigrationUpdating, setBulkMigrationUpdating] = useState(false);

  const getMigrationStart = (client: Client): number => (
    clampMigrationStart(
      migrationStartDraft ?? client.migracionDesdeCuota ?? getSuggestedMigrationStart(client.cuotas),
      client.cuotas
    )
  );

  const persistMigration = async (
    client: Client,
    active: boolean,
    requestedStart = getMigrationStart(client)
  ) => {
    if (active && !isClientMigrationEligible(client)) {
      toast.error('Los clientes nuevos ya usan el cronograma vigente y no requieren migración');
      return;
    }

    const regularInstallments = getRegularInstallmentNumbers(client.cuotas);
    if (regularInstallments.length === 0) {
      toast.error('Este cliente no tiene cuotas regulares para migrar');
      return;
    }

    const migrationStart = clampMigrationStart(requestedStart, client.cuotas);
    const migration: ClientMigrationState = {
      migracionActiva: active,
      migracionDesdeCuota: migrationStart,
      versionCronogramaMigracion: active && client.migracionActiva !== true
        ? OFFICIAL_MIGRATION_SCHEDULE_VERSION
        : client.versionCronogramaMigracion || OFFICIAL_MIGRATION_SCHEDULE_VERSION,
      migracionActualizadaEn: new Date().toISOString()
    };

    setMigrationSaving(true);
    try {
      await updateClientMigration(client.id, migration);
      setMigrationStartDraft(migrationStart);
      toast.success(active
        ? `Migración activada desde la cuota N.° ${migrationStart}`
        : 'Migración desactivada correctamente');
    } catch (err) {
      console.error('Error actualizando la migración:', err);
      setMigrationStartDraft(clampMigrationStart(
        client.migracionDesdeCuota ?? getSuggestedMigrationStart(client.cuotas),
        client.cuotas
      ));
      toast.error('No se pudo guardar la configuración de migración');
    } finally {
      setMigrationSaving(false);
    }
  };

  const handleBulkMigrationUpdate = async () => {
    setBulkMigrationUpdating(true);
    try {
      const updated = await updateMigratedClientsSchedule(OFFICIAL_MIGRATION_SCHEDULE_VERSION);
      toast.success(`${updated} cliente${updated === 1 ? '' : 's'} migrado${updated === 1 ? '' : 's'} actualizado${updated === 1 ? '' : 's'}`);
    } catch (err) {
      console.error('Error actualizando cronogramas migrados:', err);
      toast.error('No se pudo actualizar el cronograma de los clientes migrados');
    } finally {
      setBulkMigrationUpdating(false);
    }
  };

  const openClientDetail = (client: Client) => {
    setMigrationStartDraft(clampMigrationStart(
      client.migracionDesdeCuota ?? getSuggestedMigrationStart(client.cuotas),
      client.cuotas
    ));
    setSelectedClient(client.id);
    setSelectedClientId(client.id);
  };

  const startPhoneEdit = (client: Client) => {
    setEditingPhoneClientId(client.id);
    setEditCelular1(client.celular1 || '');
    setEditCelular2(client.celular2 || '');
  };

  const cancelPhoneEdit = () => {
    setEditingPhoneClientId(null);
    setEditCelular1('');
    setEditCelular2('');
  };

  const savePhoneEdit = async () => {
    if (!editingPhoneClientId) return;

    const payload = {
      celular1: editCelular1.trim(),
      celular2: editCelular2.trim()
    };

    try {
      await updateClient(editingPhoneClientId, payload);
      toast.success('Teléfonos actualizados correctamente');
      cancelPhoneEdit();
    } catch (err) {
      console.error('Error actualizando teléfonos:', err);
      toast.error('No se pudo actualizar los teléfonos');
    }
  };

  const startEmailEdit = (client: Client) => {
    setEditingEmailClientId(client.id);
    setEditEmail1(client.email1 || '');
    setEditEmail2(client.email2 || '');
  };

  const cancelEmailEdit = () => {
    setEditingEmailClientId(null);
    setEditEmail1('');
    setEditEmail2('');
  };

  const saveEmailEdit = async () => {
    if (!editingEmailClientId) return;

    const payload = {
      email1: editEmail1.trim(),
      email2: editEmail2.trim()
    };

    try {
      await updateClient(editingEmailClientId, payload);
      toast.success('Correos actualizados correctamente');
      cancelEmailEdit();
    } catch (err) {
      console.error('Error actualizando correos:', err);
      toast.error('No se pudo actualizar los correos');
    }
  };

  const getFilteredClients = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    switch (filterType) {
      case 'pending':
        return clients.filter(client => 
          client.cuotas?.some(cuota => {
       const vencimiento = new Date(cuota.vencimiento);
       const v = parseLocalDate(cuota.vencimiento);
       return v.getMonth() === currentMonth && 
         v.getFullYear() === currentYear &&
                   cuota.estado === 'pendiente' &&
                   cuota.numero > 0; // Excluir iniciales
          })
        );
      case 'overdue':
        return clients.filter(client => 
          client.cuotas?.some(cuota => {
       const v = parseLocalDate(cuota.vencimiento);
       // compare dates at local midnight
       const vencMid = new Date(v.getFullYear(), v.getMonth(), v.getDate());
       const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
       const isOverdue = vencMid.getTime() < todayMid.getTime() && 
                   cuota.estado === 'pendiente' &&
                   cuota.numero > 0; // Excluir iniciales
       if (!isOverdue) return false;
       // If a month filter is active, ensure the cuota's vencimiento matches the selected month/year
       if (overdueMonth !== null) {
         return v.getMonth() === overdueMonth && v.getFullYear() === overdueYear;
       }
       return true;
          })
        );
      default:
        return clients;
    }
  };

  const getClientStatus = (client: Client) => {
    if (!client.cuotas || client.cuotas.length === 0) return 'Sin cuotas';
    
    const cuotasPagadas = client.cuotas.filter((c: Cuota) => c.estado === 'pagado' && c.numero > 0).length;
    const totalCuotas = client.cuotas.filter((c: Cuota) => c.numero > 0).length;
    const cuotasPendientes = totalCuotas - cuotasPagadas;
    
    if (cuotasPendientes === 0) return 'Completado';
    return `Debe ${cuotasPendientes}`;
  };

  const handleDeleteClient = (clientId: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este cliente? Esta acción no se puede deshacer.')) {
      deleteClient(clientId);
      toast.success('Cliente eliminado exitosamente');
    }
  };

  const handleEditCuotasAmount = () => {
    if (!editingCuota || editingCuota.type !== 'amount') return;
    
    const newMonto = parseFloat(editMonto);
    if (isNaN(newMonto) || newMonto < 0) {
      toast.error('Ingrese un monto válido');
      return;
    }
    // If a specific cuota index is provided, update only that cuota and move the difference to the final cuota
    if (editingCuota.cuotaIndex !== undefined) {
      const client = clients.find(c => c.id === editingCuota.clientId);
      if (!client || !client.cuotas) {
        toast.error('Cliente o cuotas no encontrados');
        return;
      }

      const cuotasCopy = client.cuotas.map(c => ({ ...c }));
      const idx = editingCuota.cuotaIndex;
      const oldMonto = cuotasCopy[idx]?.monto ?? 0;
      cuotasCopy[idx].monto = newMonto;
      cuotasCopy[idx].total = newMonto + (cuotasCopy[idx].mora ?? 0);

      // Find last cuota index (highest numero > 0)
      const numeroCuotas = cuotasCopy.filter(c => c.numero > 0).length;
      let lastIndex = cuotasCopy.findIndex(c => c.numero === numeroCuotas);
      if (lastIndex === -1) lastIndex = cuotasCopy.length - 1;

      // Compute leftover: if newMonto is less than oldMonto, leftover is positive and should be
      // added to the last cuota. If newMonto > oldMonto, we subtract the difference from last cuota.
      const diffToMove = oldMonto - newMonto; // positive => add to last, negative => subtract from last

      // Only apply movement to a different cuota than the one being edited
      if (lastIndex >= 0 && lastIndex < cuotasCopy.length && lastIndex !== idx && diffToMove !== 0) {
        const last = cuotasCopy[lastIndex];
        const newLastMonto = (last.monto || 0) + diffToMove;
        // Ensure last cuota monto doesn't go negative
        last.monto = Math.max(0, Math.round((newLastMonto + Number.EPSILON) * 100) / 100);
        last.total = last.monto + (last.mora ?? 0);
      }

      // Single write (replace cuotas array)
      Promise.resolve(updateClient(editingCuota.clientId, { cuotas: cuotasCopy }))
        .then(() => {
          setEditingCuota(null);
          setEditMonto('');
          toast.success('Monto de cuota actualizado y diferencia aplicada a la última cuota');
        })
        .catch(err => {
          console.error('Error actualizando cuota individual:', err);
          toast.error('Error al actualizar cuota');
        });
      return;
    }

    // Otherwise update regular cuotas amounts (existing behaviour)
    updateCuotaAmount(editingCuota.clientId, newMonto);
    setEditingCuota(null);
    setEditMonto('');
    toast.success('Montos de cuotas actualizados exitosamente');
  };

  const handleEditMoraSave = () => {
    if (!editingMora) return;
    const v = parseFloat(editMoraValue);
    if (isNaN(v) || v < 0) { toast.error('Ingrese un monto válido para la mora'); return; }
    // Update the specific cuota mora and total
    const client = clients.find(c => c.id === editingMora.clientId);
  if (!client || !client.cuotas) return;
  const cuota = client.cuotas[editingMora.cuotaIndex];
  if (!cuota) return;
  updateCuota(editingMora.clientId, editingMora.cuotaIndex, { mora: v, total: cuota.monto + v, manualMora: true });
    setEditingMora(null);
    setEditMoraValue('');
    toast.success('Mora actualizada');
  };

  const handleEditCuotaDate = () => {
    if (!editingCuota || editingCuota.type !== 'date' || editingCuota.cuotaIndex === undefined) return;

    if (!editFecha) {
      toast.error('Ingrese una fecha válida');
      return;
    }

    // Helper: add months preserving day-of-month where possible (cap to last day)
    const addMonthsKeepingDay = (date: Date, months: number) => {
      const y = date.getFullYear();
      const m = date.getMonth();
      const d = date.getDate();
      const target = new Date(y, m + months, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(d, lastDay));
      return target;
    };

    (async () => {
      try {
        const client = clients.find(c => c.id === editingCuota.clientId);
        if (!client || !client.cuotas) return;

        const cuotaIdx = editingCuota.cuotaIndex as number;
        const baseISO = formatLocalISO(editFecha);

        if (!propagateDates) {
          // Only update the single cuota
          await Promise.resolve(updateCuotaDates(editingCuota.clientId, cuotaIdx, baseISO));
        } else {
          // Update this cuota and all following cuotas.
          // The selected cuota gets the exact date chosen by the user (baseISO).
          // All subsequent cuotas should use the LAST DAY of each successive month.
          const baseDate = parseLocalDate(baseISO);
          const updatedCuotas = client.cuotas.map((c, idx) => {
            if (idx < cuotaIdx) return c;
            const monthsToAdd = idx - cuotaIdx;
            if (monthsToAdd === 0) {
              return { ...c, vencimiento: baseISO };
            }
            // compute last day of (base month + monthsToAdd)
            const year = baseDate.getFullYear();
            const month = baseDate.getMonth() + monthsToAdd;
            const lastDay = new Date(year, month + 1, 0).getDate();
            const target = new Date(year, month, lastDay);
            return { ...c, vencimiento: formatLocalISO(target) };
          });

          // Single write to update all cuotas at once
          await updateClient(editingCuota.clientId, { cuotas: updatedCuotas });
        }

        setEditingCuota(null);
        setEditFecha('');
        setPropagateDates(false);
        toast.success('Fecha(s) de vencimiento actualizada(s)');
      } catch (err) {
        console.error('Error actualizando fechas de cuotas:', err);
        toast.error('Error al actualizar fechas de cuotas');
      }
    })();
  };

  const handleMarkAsPaid = (clientId: string, cuotaIndex: number) => {
    // Ensure the paymentDate is passed as local ISO (yyyy-MM-dd)
    markCuotaAsPaid(clientId, cuotaIndex, paymentDate);
    toast.success('Cuota marcada como pagada');
  };

  const handleFileUpload = (clientId: string, cuotaIndex: number, fileType: 'voucher' | 'boleta') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.multiple = true; // Permitir múltiples archivos
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        // We'll store objects with both the download URL and the original filename
        const uploadedItems: Array<{ url: string; name?: string }> = [];
        for (let i = 0; i < files.length; i++) {
          try {
            const file = files[i];
            const originalName = file.name;
            const dotIndex = originalName.lastIndexOf('.');
            const baseName = dotIndex !== -1 ? originalName.slice(0, dotIndex) : originalName;
            const ext = dotIndex !== -1 ? originalName.slice(dotIndex) : '';
            // Append a short unique suffix to the stored file name to avoid collisions in Storage
            const uniqueCode = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
            const finalName = `${baseName}_${uniqueCode}${ext}`;
            const path = `clients/${clientId}/cuotas/${cuotaIndex}/${finalName}`;
            const sRef = storageRef(storage, path);
            // upload as bytes
            const snapshot = await uploadBytes(sRef, file);
            const url = await getDownloadURL(snapshot.ref);
            uploadedItems.push({ url, name: originalName });
          } catch (err) {
            console.error('Error subiendo archivo:', err);
            toast.error('Error subiendo uno o más archivos');
          }
        }

        if (uploadedItems.length > 0) {
          // Concatenar con existentes si las hay. Normalize existing entries to objects of {url,name?}
          const client = clients.find(c => c.id === clientId);
          const existingRaw = client?.cuotas ? client.cuotas[cuotaIndex]?.[fileType] : undefined;
          const normalize = (raw: Cuota['voucher']): Array<{ url: string; name?: string }> => {
            if (!raw) return [];
            if (Array.isArray(raw)) return raw.map(r => (typeof r === 'string' ? { url: r } : r));
            return (typeof raw === 'string') ? [{ url: raw }] : [raw];
          };
          const existing = normalize(existingRaw);
          const merged = [...existing, ...uploadedItems];
          updateCuota(clientId, cuotaIndex, { [fileType]: merged });
          toast.success(`${uploadedItems.length} ${fileType === 'voucher' ? 'voucher(s)' : 'boleta(s)'} subido(s) exitosamente`);
        }
      }
    };
    input.click();
  };

  const downloadAllFiles = (files: Cuota['voucher'], filenamePrefix: string) => {
    if (!files) return;
    // Normalize to array of objects {url, name?} or strings
    const arrRaw = Array.isArray(files) ? files : [files];
    const arr = arrRaw.map(item => (typeof item === 'string' ? { url: item as string } : item)) as Array<{ url: string; name?: string }>;
    // Create a zip-like multiple download by triggering each file download sequentially
    // For cross-origin URLs (Firebase Storage) the `download` attribute may be ignored.
    // Fetch each file as a blob (CORS must allow GET), then create an object URL and force download.
    (async () => {
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i] as { url: string; name?: string };
        try {
          const res = await fetch(item.url, { mode: 'cors' });
          if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
          const blob = await res.blob();
          // determine download filename: prefer original name if present
          let downloadName = item.name;
          // try to infer extension from content-type or url when name missing
          if (!downloadName) {
            const contentType = blob.type || '';
            let ext = '';
            if (contentType) {
              const parts = contentType.split('/');
              if (parts.length === 2) ext = '.' + parts[1].split('+')[0];
            }
            if (!ext) {
              const m = (item.url).match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
              if (m) ext = '.' + m[1];
            }
            downloadName = `${filenamePrefix}_${i}${ext}`;
          }

          const objUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objUrl;
          a.download = downloadName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(objUrl);
        } catch (err) {
          console.error('Error downloading file', err);
          // Fallback: abrir en nueva pestaña para que el usuario pueda guardar manualmente
          try {
            const item = arr[i] as { url: string; name?: string };
            const a = document.createElement('a');
            a.href = item.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast('No se pudo forzar la descarga por CORS; se ha abierto el archivo en una nueva pestaña. Use "Guardar como" para descargar.');
          } catch (e) {
            toast.error('Error al descargar uno o más archivos. Revise la consola.');
          }
        }
      }
    })();
  };

  const openAllFiles = (files: Cuota['voucher']) => {
    if (!files) return;
    const arrRaw = Array.isArray(files) ? files : [files];
    const arr = arrRaw.map(item => (typeof item === 'string' ? { url: item } : item)) as Array<{ url: string; name?: string }>;
    arr.forEach(item => {
      try {
        if (item && item.url) window.open(item.url, '_blank');
      } catch (e) {
        console.error('openAllFiles error opening file', e);
      }
    });
  };

  const formatDate = (dateString: string) => {
    const d = parseLocalDate(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getEffectiveMora = (cuota: Cuota): number => {
    if (cuota.numero === 0) return 0;
    if (cuota.estado === 'pagado' && typeof cuota.mora === 'number') return cuota.mora;
    if (cuota.manualMora === true && typeof cuota.mora === 'number') return cuota.mora;
    return calculateMora(cuota.vencimiento, cuota.monto);
  };

  // Prepare month/year options for the overdue filter
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];
  const yearsSet = new Set<number>();
  clients.forEach(c => c.cuotas?.forEach(q => {
    try { yearsSet.add(parseLocalDate(q.vencimiento).getFullYear()); } catch (e) { /* ignore parse errors */ }
  }));
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);
  if (availableYears.length === 0) availableYears.push(new Date().getFullYear());

  const resetOverdueFilter = () => { setOverdueMonth(null); setOverdueYear(new Date().getFullYear()); };

  const exportToPDF = (client: Client) => {
    (async () => {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const migrationActive = isClientMigrationEnabled(client);
      const scheduleSections = client.cuotas?.length > 0
        ? [{
            kind: migrationActive ? 'migration' as const : 'base' as const,
            installments: [...client.cuotas],
            config: migrationActive
              ? getPaymentScheduleConfigByVersion(OFFICIAL_MIGRATION_SCHEDULE_VERSION)
              : getPaymentScheduleConfig(client)
          }]
        : [];
      if (scheduleSections.length === 0) {
        toast.error('El cliente no tiene cuotas para exportar');
        return;
      }
      // Try to fetch logo and embed as base64
      const fetchImageAsDataURL = async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          return await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          return null;
        }
      };

      for (let sectionIndex = 0; sectionIndex < scheduleSections.length; sectionIndex += 1) {
        const section = scheduleSections[sectionIndex];
        const scheduleConfig = section.config;
        const sectionCuotas = section.installments;
        if (sectionIndex > 0) doc.addPage();

      let logoData: Array<string | null> = [];
      try {
        logoData = await Promise.all(scheduleConfig.logoUrls.map(fetchImageAsDataURL));
      } catch (err) {
        console.error('Error fetching schedule logos:', err);
        logoData = scheduleConfig.logoUrls.map(() => null);
      }

      // The legacy layout remains untouched for existing clients. New clients
      // receive A&T first (left), followed by Condominio Villa Hermosa (right).
      let titleY = 20;
      if (scheduleConfig.logoLayout === 'paired-square') {
        const logoSize = 46;
        const logoTop = 5;
        const logoSideMargin = 5;
        const logoPositions = [
          logoSideMargin,
          pageWidth - logoSideMargin - logoSize
        ];

        logoData.forEach((imageData, index) => {
          if (!imageData) return;
          try {
            doc.addImage(imageData, 'JPEG', logoPositions[index], logoTop, logoSize, logoSize);
          } catch (err) {
            console.error(`Error adding schedule logo ${index + 1} to PDF:`, err);
          }
        });
        titleY = logoTop + logoSize + 6;
      } else if (logoData[0]) {
        try {
          const imgProps = doc.getImageProperties(logoData[0]);
          const imgW = pageWidth - 20; // 10mm margin each side
          const imgH = (imgProps.height * imgW) / imgProps.width;
          doc.addImage(logoData[0], 'JPEG', 10, 6, imgW, imgH);
          titleY = 6 + imgH + 6;
        } catch (err) {
          console.error('Error adding logo to PDF:', err);
          titleY = 20;
        }
      }

      // Title
      doc.setFontSize(16);
      doc.text('CRONOGRAMA DE PAGOS', pageWidth / 2, titleY, { align: 'center' });

      // Contact bar under title
      const contactY = titleY + 6;
      doc.setFontSize(10);
      doc.setFillColor(255, 205, 0);
      doc.rect(20, contactY - 4, pageWidth - 40, 6, 'F');
      doc.setTextColor(0);
      doc.text(`Telefono de cobranza Villa Hermosa: ${scheduleConfig.cobranzaPhone}`, 25, contactY);

  // Client info block (left) and bank info block (right)
      const infoStartY = contactY + 8;
      doc.setFontSize(10);
      const leftX = 20;
      const rightX = pageWidth - 110;

  // Left column: client details (separate fields). Right column will show DNIs on same vertical start.
    const infoLineHeight = 6;
    let yInfo = infoStartY;
  doc.text(`Nombre: ${client.nombre1 || ''}`, leftX, yInfo); yInfo += infoLineHeight;
  if (client.nombre2) { doc.text(`Nombre: ${client.nombre2}`, leftX, yInfo); yInfo += infoLineHeight; }
  doc.text(`Celular: ${client.celular1 || ''}`, leftX, yInfo); yInfo += infoLineHeight;
  if (client.celular2) { doc.text(`Celular: ${client.celular2}`, leftX, yInfo); yInfo += infoLineHeight; }
  doc.text(`Gmail: ${client.email1 || ''}`, leftX, yInfo); yInfo += infoLineHeight;
  if (client.email2) { doc.text(`Gmail: ${client.email2}`, leftX, yInfo); yInfo += infoLineHeight; }
    doc.text(`Precio total: S/ ${client.montoTotal.toFixed(2)}`, leftX, yInfo); yInfo += infoLineHeight;
    doc.text(`Moneda: SOLES`, leftX, yInfo); yInfo += infoLineHeight;
    doc.text(`Proyecto: ${scheduleConfig.projectName}`, leftX, yInfo); yInfo += infoLineHeight;
    doc.text(`Manzana: ${client.manzana}`, leftX, yInfo); yInfo += infoLineHeight;
    doc.text(`Lote: ${client.lote}`, leftX, yInfo); yInfo += infoLineHeight;
    doc.text(`Metraje: ${client.metraje} m2`, leftX, yInfo); yInfo += infoLineHeight;

  // Right column: DNIs aligned at top next to names (show second only if present)
  const dniX = rightX + 30;
  let yDni = infoStartY;
  doc.text(`DNI: ${client.dni1 || ''}`, dniX, yDni); yDni += infoLineHeight;
  if (client.dni2) { doc.text(`DNI: ${client.dni2}`, dniX, yDni); }

    // Right column: bank info box (reordered and sized to its content)
  const bankY = infoStartY + (infoLineHeight * 4) + 2; // moved a bit up
    doc.setFontSize(9);
    doc.setTextColor(0);
    const bankLines = scheduleConfig.bankLines;
    // measure text width and height to draw a tight green box
    let maxBankTextWidth = 0;
    bankLines.forEach(l => {
      try {
        const w = doc.getTextWidth(l);
        if (w > maxBankTextWidth) maxBankTextWidth = w;
      } catch (e) {
        // fallback width
        if (l.length * 2 > maxBankTextWidth) maxBankTextWidth = l.length * 2;
      }
    });
    const bankPad = 4;
  const boxWidth = maxBankTextWidth + bankPad * 2;
    const boxHeight = (bankLines.length * infoLineHeight) + bankPad * 2;
  let boxX = rightX + 8; // move box a bit to the right
    // ensure the box doesn't overflow the right margin
    if (boxX + boxWidth > pageWidth - 10) boxX = pageWidth - 10 - boxWidth;
    doc.setFillColor(200, 230, 201);
    doc.rect(boxX, bankY - 2, boxWidth, boxHeight, 'F');
    // draw bank lines inside box
    let yBank = bankY + bankPad;
    bankLines.forEach((line, index) => {
      doc.setFont(undefined, index === bankLines.length - 1 ? 'bold' : 'normal');
      doc.text(line, boxX + bankPad, yBank);
      yBank += infoLineHeight;
    });
    doc.setFont(undefined, 'normal');

  // Table header start Y (leave ample space so nothing se solape)
  const tableStartY = bankY + boxHeight + 12;

      // Prepare table rows, computing mora (manual or calculated) and total per row
      const rows = sectionCuotas.map((cuota) => {
        const moraDisplayed = getEffectiveMora(cuota);
        const totalForRow = cuota.monto + moraDisplayed;
        return [
          cuota.numero === 0 ? 'Inicial' : String(cuota.numero),
          formatDate(cuota.vencimiento),
          cuota.monto.toFixed(2),
          moraDisplayed.toFixed(2),
          totalForRow.toFixed(2),
          cuota.fechaPago ? formatDate(cuota.fechaPago) : '',
          cuota.estado,
          Array.isArray(cuota.voucher) ? String(cuota.voucher.length) : (cuota.voucher ? '1' : ''),
          Array.isArray(cuota.boleta) ? String(cuota.boleta.length) : (cuota.boleta ? '1' : '')
        ];
      });

      // Use the ESM autoTable function and read the final position from jsPDF.
      let tableEndY = tableStartY;
      try {
        autoTable(doc, {
          startY: tableStartY,
          margin: { left: 20, right: 20 },
          head: [['N°','vencimiento','Monto','Mora','Total','Fecha de Pago','Estado','Vouchers','Boletas']],
          body: rows,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [0,102,204], textColor: 255 },
          alternateRowStyles: { fillColor: [245,245,245] },
          columnStyles: {
            1: { cellWidth: 26 },
            2: { cellWidth: 18 },
            5: { cellWidth: 24 },
            6: { cellWidth: 20 },
            7: { cellWidth: 18 },
            8: { cellWidth: 14 }
          }
        });
        tableEndY = (doc.lastAutoTable?.finalY ?? tableStartY) + 6;
      } catch (err) {
        console.error('autoTable error', err);
        // If something else fails, at least dump rows safely
        let y = tableStartY;
        doc.setFontSize(9);
        rows.forEach(r => {
          const line = r.join(' | ');
          const parts = doc.splitTextToSize(line, pageWidth - 40);
          doc.text(parts, 20, y);
          y += (parts.length * 6) + 2;
          if (y > 270) { doc.addPage(); y = 20; }
        });
        tableEndY = y + 4;
      }
      // Footer: totals and note, placed right after the table (tableEndY)
      try {
  let footerY = tableEndY;
        // If footer would overflow page, add a new page
        const pageH = doc.internal.pageSize.getHeight();
        if (footerY + 30 > pageH - 10) {
          doc.addPage();
          footerY = 20;
        }
        doc.setFontSize(10);
        // Compute totals using the same displayed values shown in the modal table:
        // displayedMora = cuota.numero === 0 ? 0 : (manualMora ? cuota.mora : calculateMora(...))
        // totalDisplayed = cuota.monto + displayedMora
        const totalPagado = sectionCuotas.reduce((acc, c) => {
          const moraDisplayed = getEffectiveMora(c);
          const totalDisplayed = (c.monto || 0) + moraDisplayed;
          return acc + ((c.estado === 'pagado') ? totalDisplayed : 0);
        }, 0);
        const totalPendiente = sectionCuotas.reduce((acc, c) => {
          const moraDisplayed = getEffectiveMora(c);
          const totalDisplayed = (c.monto || 0) + moraDisplayed;
          return acc + ((c.estado !== 'pagado') ? totalDisplayed : 0);
        }, 0);
        doc.text(`Importe total pagado S/ ${totalPagado.toFixed(2)}`, 20, footerY);
        doc.text(`Importe pendiente S/ ${totalPendiente.toFixed(2)}`, 20, footerY + 6);
        // small green strip below totals
        // Draw totals
        doc.setFillColor(220, 240, 220);
        // NOTE: draw the green box exactly around the note text (with padding)
        const noteText = `NOTA: UNA VEZ CANCELADO LA CUOTA MENSUAL, ENVIAR FOTO DEL VOUCHER AL NUMERO DE COBRANZA: ${scheduleConfig.cobranzaPhone}`;
        const noteFontSize = 8; // smaller font to ensure fit
        doc.setFontSize(noteFontSize);
        // split note into lines that fit inside the content width
        const contentWidth = pageWidth - 30; // left/right padding
        const noteLines = doc.splitTextToSize(noteText, contentWidth);
        const lineHeight = 4.2; // approximate mm per line at this font size
        const boxPadding = 3;
        const boxHeight = (noteLines.length * lineHeight) + (boxPadding * 2);
        const boxX = 15;
        const boxY = footerY + 10;
        doc.setFillColor(220, 240, 220);
        doc.rect(boxX, boxY, contentWidth + (boxPadding * 2) - 2, boxHeight, 'F');
        doc.setTextColor(0);
        // draw note lines inside the box with a small left padding
        let currentY = boxY + boxPadding + lineHeight;
        noteLines.forEach(line => {
          doc.text(line, boxX + boxPadding, currentY);
          currentY += lineHeight;
        });
      } catch (err) {
        console.error('PDF footer error', err);
      }
      }

      try {
        doc.save(`cronograma_${client.nombre1}_${client.dni1}.pdf`);
        toast.success('PDF descargado exitosamente');
      } catch (err) {
        console.error('Error saving PDF', err);
        toast.error('Error al generar el PDF. Revise la consola para más detalles.');
      }
    })();
  };

  const exportToExcel = (client: Client) => {
    (async () => {
      const scheduleSections = getPaymentScheduleSections(client);
      if (scheduleSections.length === 0) {
        toast.error('El cliente no tiene cuotas para exportar');
        return;
      }

      // Try to fetch logo as base64 to embed in the HTML
      const fetchImageAsDataURL = async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          return await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          return null;
        }
      };

      const sectionHtmlBlocks: string[] = [];

      for (let sectionIndex = 0; sectionIndex < scheduleSections.length; sectionIndex += 1) {
        const section = scheduleSections[sectionIndex];
        const scheduleConfig = section.config;
        const sectionCuotas = section.installments;
        const logoData = await Promise.all(scheduleConfig.logoUrls.map(fetchImageAsDataURL));

        let headerHtml = '<div style="text-align:center;">';
        if (scheduleConfig.logoLayout === 'paired-square') {
          const leftLogo = logoData[0]
            ? `<img src="${logoData[0]}" width="174" height="174" style="display:block;"/>`
            : '';
          const rightLogo = logoData[1]
            ? `<img src="${logoData[1]}" width="174" height="174" style="display:block;margin-left:auto;"/>`
            : '';
          headerHtml += `<table role="presentation" style="width:100%;border-collapse:collapse;"><tr>
            <td width="50%" align="left" style="padding-left:19px;">${leftLogo}</td>
            <td width="50%" align="right" style="padding-right:19px;">${rightLogo}</td>
          </tr></table>`;
        } else if (logoData[0]) {
          headerHtml += `<img src="${logoData[0]}" style="width:100%;height:auto;"/>`;
        }
        headerHtml += '<h2>CRONOGRAMA DE PAGOS</h2>';
        if (isClientMigrationEnabled(client)) {
          const migrationStart = Number(client.migracionDesdeCuota);
          const sectionTitle = section.kind === 'migration'
            ? `NUEVA EMPRESA - CUOTA ${migrationStart} EN ADELANTE`
            : migrationStart === 1
              ? 'CONFIGURACION BASE - CUOTA INICIAL'
              : `CONFIGURACION BASE - CUOTA INICIAL Y CUOTAS 1 A ${migrationStart - 1}`;
          headerHtml += `<h3 style="margin:0 0 6px;">${sectionTitle}</h3>`;
        }
        headerHtml += `<div style="background:#ffd700;padding:4px;margin-bottom:6px;">Telefono de cobranza Villa Hermosa: ${scheduleConfig.cobranzaPhone}</div>`;
        headerHtml += '</div>';

        let infoHtml = '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr>';
        infoHtml += '<td style="vertical-align:top;width:60%;"><table style="width:100%;">';
        infoHtml += `<tr><td><strong>Nombre 1</strong></td><td>${client.nombre1 || ''}</td></tr>`;
        if (client.nombre2) infoHtml += `<tr><td><strong>Nombre 2</strong></td><td>${client.nombre2}</td></tr>`;
        infoHtml += `<tr><td><strong>DNI 1</strong></td><td>${client.dni1 || ''}</td></tr>`;
        if (client.dni2) infoHtml += `<tr><td><strong>DNI 2</strong></td><td>${client.dni2}</td></tr>`;
        infoHtml += `<tr><td><strong>Celular 1</strong></td><td>${client.celular1 || ''}</td></tr>`;
        if (client.celular2) infoHtml += `<tr><td><strong>Celular 2</strong></td><td>${client.celular2}</td></tr>`;
        infoHtml += `<tr><td><strong>Gmail 1</strong></td><td>${client.email1 || ''}</td></tr>`;
        if (client.email2) infoHtml += `<tr><td><strong>Gmail 2</strong></td><td>${client.email2}</td></tr>`;
        infoHtml += `<tr><td><strong>Precio total</strong></td><td>S/ ${client.montoTotal.toFixed(2)}</td></tr>`;
        infoHtml += '<tr><td><strong>Moneda</strong></td><td>SOLES</td></tr>';
        infoHtml += `<tr><td><strong>Proyecto</strong></td><td>${scheduleConfig.projectName}</td></tr>`;
        infoHtml += `<tr><td><strong>Manzana</strong></td><td>${client.manzana}</td></tr>`;
        infoHtml += `<tr><td><strong>Lote</strong></td><td>${client.lote}</td></tr>`;
        infoHtml += `<tr><td><strong>Metraje</strong></td><td>${client.metraje} m2</td></tr>`;
        infoHtml += '</table></td>';

        const bankHtml = scheduleConfig.logoLayout === 'legacy-wide'
          ? `<div style="font-size:12px;font-weight:600;">${scheduleConfig.bankLines[0]}</div>
            <div>${scheduleConfig.bankLines[1]}</div>
            <div>${scheduleConfig.bankLines[2]}</div>
            <div style="margin-top:6px;font-weight:bold;">${scheduleConfig.bankLines[3]}</div>`
          : scheduleConfig.bankLines.map((line, index) => (
            `<div style="${index === scheduleConfig.bankLines.length - 1 ? 'margin-top:6px;font-weight:bold;' : ''}">${line}</div>`
          )).join('');
        infoHtml += `<td style="vertical-align:top;padding:8px;">
          <div style="display:inline-block;background:#c8e6c9;padding:8px;border-radius:2px;">${bankHtml}</div>
        </td></tr></table>`;

        let tableHtml = '<table border="1" style="width:100%;border-collapse:collapse;border:1px solid #0066cc;">';
        tableHtml += '<tr style="background:#0066cc;color:#fff;">'
          + '<th style="width:6%;">N°</th>'
          + '<th style="width:12%;">vencimiento</th>'
          + '<th style="width:10%;">Monto</th>'
          + '<th style="width:8%;">Mora</th>'
          + '<th style="width:12%;">Total</th>'
          + '<th style="width:12%;">Fecha Pago</th>'
          + '<th style="width:18%;">Estado</th>'
          + '<th style="width:12%;">Vouchers</th>'
          + '<th style="width:10%;">Boletas</th>'
          + '</tr>';
        sectionCuotas.forEach(cuota => {
          const vouchersCount = Array.isArray(cuota.voucher) ? cuota.voucher.length : (cuota.voucher ? 1 : 0);
          const boletasCount = Array.isArray(cuota.boleta) ? cuota.boleta.length : (cuota.boleta ? 1 : 0);
          const moraDisplayed = getEffectiveMora(cuota);
          const totalDisplayed = cuota.monto + moraDisplayed;
          tableHtml += `<tr>
            <td>${cuota.numero === 0 ? 'Inicial' : cuota.numero}</td>
            <td>${formatDate(cuota.vencimiento)}</td>
            <td>S/ ${cuota.monto.toFixed(2)}</td>
            <td>S/ ${moraDisplayed.toFixed(2)}</td>
            <td>S/ ${totalDisplayed.toFixed(2)}</td>
            <td>${cuota.fechaPago ? formatDate(cuota.fechaPago) : ''}</td>
            <td>${cuota.estado}</td>
            <td>${vouchersCount > 0 ? vouchersCount + ' voucher(s)' : ''}</td>
            <td>${boletasCount > 0 ? boletasCount + ' boleta(s)' : ''}</td>
          </tr>`;
        });
        tableHtml += '</table>';

        const totalPagado = sectionCuotas.reduce((acc, cuota) => {
          const totalDisplayed = cuota.monto + getEffectiveMora(cuota);
          return acc + (cuota.estado === 'pagado' ? totalDisplayed : 0);
        }, 0);
        const totalPendiente = sectionCuotas.reduce((acc, cuota) => {
          const totalDisplayed = cuota.monto + getEffectiveMora(cuota);
          return acc + (cuota.estado !== 'pagado' ? totalDisplayed : 0);
        }, 0);
        const footerHtml = `
          <div style="margin-top:8px;">
            <div>Importe total pagado S/ ${totalPagado.toFixed(2)}</div>
            <div>Importe pendiente S/ ${totalPendiente.toFixed(2)}</div>
          </div>
          <div style="margin-top:6px;">
            <div style="display:inline-block;background:#c8e6c9;padding:6px;font-size:11px;">
              NOTA: UNA VEZ CANCELADO LA CUOTA MENSUAL, ENVIAR FOTO DEL VOUCHER AL NUMERO DE COBRANZA: ${scheduleConfig.cobranzaPhone}
            </div>
          </div>`;
        const breakStyle = sectionIndex > 0 ? 'page-break-before:always;' : '';
        sectionHtmlBlocks.push(`<section style="${breakStyle}">${headerHtml}${infoHtml}${tableHtml}${footerHtml}</section>`);
      }

      const fullHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body>${sectionHtmlBlocks.join('')}</body></html>`;

      const blob = new Blob([fullHtml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cronograma_${client.nombre1}_${client.dni1}.xls`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel descargado exitosamente');
    })();
  };

  const getClientPaymentTotals = (client: Client) => {
    // Las ventas al contado representan pagos completos, aunque no tengan cronograma.
    if (client.formaPago === 'contado') {
      return {
        totalPagado: Number(client.montoTotal || 0),
        totalPendiente: 0
      };
    }

    return (client.cuotas || []).reduce((totals, cuota) => {
      const mora = getEffectiveMora(cuota);
      const importe = Number(cuota.monto || 0) + Number(mora || 0);

      if (cuota.estado === 'pagado') {
        totals.totalPagado += importe;
      } else {
        totals.totalPendiente += importe;
      }

      return totals;
    }, { totalPagado: 0, totalPendiente: 0 });
  };

  const exportClientsToPDF = () => {
    if (filteredClients.length === 0) {
      toast.error('No hay clientes para descargar.');
      return;
    }

    try {
      // Generar directamente en A4 horizontal para evitar que la impresora reduzca un A3.
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const generatedAt = new Date().toLocaleString('es-PE');
      const money = (value: number) => `S/ ${Number(value || 0).toFixed(2)}`;

      const financedClients = filteredClients.filter(client => client.formaPago === 'cuotas');
      const cashClients = filteredClients.filter(client => client.formaPago === 'contado');
      const legacyEligibleClients = filteredClients.filter(client => isClientMigrationEligible(client));
      const newClients = filteredClients.filter(client => !isClientMigrationEligible(client));
      const migratedClients = filteredClients.filter(client => isClientMigrationEnabled(client));

      const calculateGroupTotals = (group: Client[]) => group.reduce((acc, client) => {
        const paymentTotals = getClientPaymentTotals(client);
        acc.montoTotal += Number(client.montoTotal || 0);
        acc.pagado += paymentTotals.totalPagado;
        acc.pendiente += paymentTotals.totalPendiente;
        return acc;
      }, { montoTotal: 0, pagado: 0, pendiente: 0 });

      const totals = calculateGroupTotals(filteredClients);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(30, 64, 175);
      doc.text('REPORTE GENERAL DE CLIENTES', 14, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`Generado: ${generatedAt} | Total de clientes: ${filteredClients.length}`, 14, 23);

      const renderClientGroup = (
        title: string,
        group: Client[],
        color: [number, number, number],
        addPage: boolean
      ) => {
        if (addPage) doc.addPage();

        const startY = addPage ? 18 : 34;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...color);
        doc.text(`${title} (${group.length})`, 10, startY - 5);

        const rows = group.map((client, index) => {
          const paymentTotals = getClientPaymentTotals(client);
          return [
            index + 1,
            [client.nombre1, client.nombre2].filter(Boolean).join(' '),
            [client.dni1, client.dni2].filter(Boolean).join(' / '),
            [client.celular1, client.celular2].filter(Boolean).join(' / ') || '-',
            [client.email1, client.email2].filter(Boolean).join(' / ') || '-',
            client.manzana,
            client.lote,
            `${Number(client.metraje || 0).toFixed(2)} m2`,
            money(client.montoTotal),
            client.numeroCuotas || 0,
            isClientMigrationEnabled(client)
              ? `Sí, desde cuota ${client.migracionDesdeCuota}`
              : isClientMigrationEligible(client) ? 'No' : 'No aplica',
            money(paymentTotals.totalPagado),
            money(paymentTotals.totalPendiente)
          ];
        });

        autoTable(doc, {
          startY,
          head: [[
            'N°', 'Nombres', 'DNIs', 'Celulares', 'Emails', 'Mz.', 'Lote', 'Metraje',
            'Monto total', 'Cuotas', 'Migración',
            'Total pagado (incl. inicial)', 'Monto pendiente'
          ]],
          body: rows,
          theme: 'grid',
          styles: { fontSize: 6.5, cellPadding: 1.4, overflow: 'linebreak', valign: 'middle' },
          headStyles: { fillColor: color, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [241, 245, 249] },
          margin: { top: 14, right: 10, bottom: 16, left: 10 },
          didDrawPage: () => {
          const pageNumber = doc.getNumberOfPages();
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text(`Página ${pageNumber}`, pageWidth - 10, pageHeight - 7, { align: 'right' });
          }
        });

        const groupTotals = calculateGroupTotals(group);
        autoTable(doc, {
          startY: (doc.lastAutoTable?.finalY || startY) + 5,
          body: [[
            `Subtotal ${title}`,
            `${group.length} clientes`,
            `Contratos: ${money(groupTotals.montoTotal)}`,
            `Pagado: ${money(groupTotals.pagado)}`,
            `Pendiente: ${money(groupTotals.pendiente)}`
          ]],
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2, fontStyle: 'bold' },
          bodyStyles: { fillColor: [248, 250, 252], textColor: color },
          margin: { left: 10, right: 10, bottom: 16 }
        });
      };

      if (financedClients.length > 0) {
        renderClientGroup('CLIENTES FINANCIADOS', financedClients, [30, 64, 175], false);
      }
      if (cashClients.length > 0) {
        renderClientGroup('CLIENTES AL CONTADO', cashClients, [5, 150, 105], financedClients.length > 0);
      }

      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(22, 101, 52);
      doc.text('RESUMEN GENERAL', 10, 18);

      const summaryRows = [
        ['Total de clientes', String(filteredClients.length)],
        ['Clientes financiados', String(financedClients.length)],
        ['Clientes al contado', String(cashClients.length)],
        ['Clientes antiguos migrados', String(migratedClients.length)],
        ['Clientes antiguos sin migrar', String(legacyEligibleClients.length - migratedClients.length)],
        ['Clientes nuevos (migración no aplica)', String(newClients.length)],
        ['Valor total de contratos', money(totals.montoTotal)],
        ['TOTAL PAGADO POR TODOS LOS CLIENTES', money(totals.pagado)],
        ['TOTAL PENDIENTE DE TODOS LOS CLIENTES', money(totals.pendiente)]
      ];

      autoTable(doc, {
        startY: 24,
        head: [['RESUMEN GENERAL', 'IMPORTE']],
        body: summaryRows,
        theme: 'grid',
        margin: { left: 10, bottom: 16 },
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
        didParseCell: (data: {
          section: string;
          row: { index: number };
          cell: { styles: { fillColor: number[]; fontStyle: string } };
        }) => {
          if (data.section === 'body' && data.row.index >= 7) {
            data.cell.styles.fillColor = data.row.index === 7 ? [220, 252, 231] : [254, 226, 226];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        didDrawPage: () => {
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - 10, pageHeight - 7, { align: 'right' });
        }
      });

      doc.save(`reporte_clientes_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Reporte de clientes descargado en PDF.');
    } catch (error) {
      console.error('Error generando reporte general de clientes:', error);
      toast.error('No se pudo generar el reporte PDF de clientes.');
    }
  };

  const filteredClients = getFilteredClients();
  const activeMigratedClientsCount = clients.filter((client: Client) => (
    isClientMigrationEnabled(client)
  )).length;

  return (
    <div className="space-y-6 w-full">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Total de clientes: {filteredClients.length}</CardTitle>
          <div className="flex flex-wrap justify-end gap-2">
            {filterType === 'all' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={activeMigratedClientsCount === 0 || bulkMigrationUpdating}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${bulkMigrationUpdating ? 'animate-spin' : ''}`} />
                    {bulkMigrationUpdating
                      ? 'Actualizando…'
                      : `Actualizar cronograma migrados (${activeMigratedClientsCount})`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Actualizar el cronograma de clientes migrados?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se aplicará el cronograma oficial registrado a {activeMigratedClientsCount} cliente{activeMigratedClientsCount === 1 ? '' : 's'} antiguo{activeMigratedClientsCount === 1 ? '' : 's'} con migración activada. Los clientes nuevos no participan; toda la información histórica de cuotas, pagos, mora, vouchers y boletas permanecerá sin cambios.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkMigrationUpdate}>
                      Confirmar actualización
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={exportClientsToPDF} disabled={filteredClients.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Descargar clientes PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filterType === 'overdue' && (
            <div className="mb-4 flex items-center space-x-3">
              <Label>Mes de atraso:</Label>
              <select
                className="border rounded px-2 py-1"
                value={overdueMonth === null ? '' : String(overdueMonth)}
                onChange={(e) => setOverdueMonth(e.target.value === '' ? null : parseInt(e.target.value, 10))}
              >
                <option value="">Todos</option>
                {monthNames.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>

              <select
                className="border rounded px-2 py-1"
                value={String(overdueYear)}
                onChange={(e) => setOverdueYear(parseInt(e.target.value, 10))}
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <Button size="sm" variant="outline" onClick={resetOverdueFilter}>Limpiar</Button>
            </div>
          )}
          <div className="w-full overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombres</TableHead>
                  <TableHead>DNIs</TableHead>
                  <TableHead>Celulares</TableHead>
                  <TableHead>Emails</TableHead>
                  <TableHead>Manzana</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Metraje</TableHead>
                  <TableHead>Monto Total</TableHead>
                  <TableHead>Forma Pago</TableHead>
                  <TableHead>Inicial</TableHead>
                  <TableHead>Cuotas</TableHead>
                  <TableHead>Migración</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Opciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client, index) => (
                  <TableRow key={client.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{client.nombre1} {client.nombre2}</TableCell>
                    <TableCell>{client.dni1} {client.dni2}</TableCell>
                    <TableCell>
                      {editingPhoneClientId === client.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editCelular1}
                            onChange={(e) => setEditCelular1(e.target.value)}
                            placeholder="Celular 1"
                            className="w-full"
                          />
                          <Input
                            value={editCelular2}
                            onChange={(e) => setEditCelular2(e.target.value)}
                            placeholder="Celular 2"
                            className="w-full"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={savePhoneEdit}>
                              Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelPhoneEdit}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col text-sm">
                            <span>{client.celular1 || '-'}</span>
                            <span className="text-xs text-slate-500">{client.celular2 || ''}</span>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => startPhoneEdit(client)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingEmailClientId === client.id ? (
                        <div className="space-y-2">
                          <Input
                            type="email"
                            value={editEmail1}
                            onChange={(e) => setEditEmail1(e.target.value)}
                            placeholder="Correo 1"
                            className="w-full"
                          />
                          <Input
                            type="email"
                            value={editEmail2}
                            onChange={(e) => setEditEmail2(e.target.value)}
                            placeholder="Correo 2"
                            className="w-full"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEmailEdit}>
                              Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEmailEdit}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col text-sm">
                            <span>{client.email1 || '-'}</span>
                            <span className="text-xs text-slate-500">{client.email2 || ''}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label="Editar correos"
                            title="Editar correos"
                            onClick={() => startEmailEdit(client)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{client.manzana}</TableCell>
                    <TableCell>{client.lote}</TableCell>
                    <TableCell>{client.metraje} m²</TableCell>
                    <TableCell>S/ {client.montoTotal.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={client.formaPago === 'contado' ? 'default' : 'secondary'}>
                        {client.formaPago}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {client.inicial ? `S/ ${client.inicial.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>{client.numeroCuotas || '-'}</TableCell>
                    <TableCell className="min-w-44">
                      {!isClientMigrationEligible(client) ? (
                        <div className="space-y-1">
                          <Badge variant="secondary">NO APLICA</Badge>
                          <div className="text-xs text-slate-500">
                            Cliente nuevo · cronograma vigente
                          </div>
                        </div>
                      ) : isClientMigrationEnabled(client) ? (
                        <div className="space-y-1">
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">ACTIVADA</Badge>
                          <div className="text-xs font-medium">Desde cuota N.° {client.migracionDesdeCuota}</div>
                          <div className="text-xs text-slate-500">
                            {getPaymentScheduleConfig(client, Number(client.migracionDesdeCuota)).projectName}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="outline">DESACTIVADA</Badge>
                          <div className="text-xs text-slate-500">
                            Base: {getPaymentScheduleConfig(client).projectName}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getClientStatus(client)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                        <div className="flex space-x-2">
                        {client.cuotas && client.cuotas.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openClientDetail(client)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Cuotas
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingCuota({ clientId: client.id, type: 'amount' })}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteClient(client.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de cuotas */}
      {selectedClient && (
        <Dialog open={true} onOpenChange={() => {
          setSelectedClient(null);
          setSelectedClientId(null);
          setMigrationStartDraft(null);
        }}>
  <DialogContent className="w-[98vw] max-w-[1400px] max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Detalle de Cuotas</span>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const client = clients.find(c => c.id === selectedClient);
                      if (client) exportToPDF(client);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const client = clients.find(c => c.id === selectedClient);
                      if (client) exportToExcel(client);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            {(() => {
              const client = clients.find(c => c.id === selectedClient);
              if (!client || !client.cuotas) return null;
              const regularInstallments = getRegularInstallmentNumbers(client.cuotas);
              const migrationStart = getMigrationStart(client);
              const migrationEligible = isClientMigrationEligible(client);
              const migrationActive = isClientMigrationEnabled(client);
              const sliderMinimum = regularInstallments[0] ?? 1;
              const sliderMaximum = regularInstallments[regularInstallments.length - 1] ?? 1;

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 rounded bg-gray-50 p-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
                    <div className="grid grid-cols-1 content-start gap-4 self-start text-sm md:grid-cols-2">
                      <div><strong>Cliente:</strong> {client.nombre1} {client.nombre2}</div>
                      <div><strong>DNI:</strong> {client.dni1}</div>
                      <div><strong>Manzana:</strong> {client.manzana}</div>
                      <div><strong>Lote:</strong> {client.lote}</div>
                      <div><strong>Email:</strong> {client.email1 || 'N/A'}</div>
                      <div><strong>Metraje:</strong> {client.metraje} m²</div>
                    </div>

                    <div className="w-full space-y-2 self-start rounded-md border bg-white p-3 text-center shadow-sm">
                        <div className="flex items-center justify-center gap-1.5 text-sm">
                          <ArrowRightLeft className="h-4 w-4 text-slate-600" />
                          <strong>Migración:</strong>
                          <Badge className={migrationActive
                            ? 'bg-emerald-600 hover:bg-emerald-600'
                            : migrationEligible
                              ? 'bg-slate-500 hover:bg-slate-500'
                              : 'bg-blue-600 hover:bg-blue-600'}>
                            {migrationActive
                              ? 'ACTIVADA'
                              : migrationEligible ? 'DESACTIVADA' : 'NO APLICA'}
                          </Badge>
                        </div>

                        {!migrationEligible ? (
                          <p className="text-xs text-slate-600">
                            Cliente nuevo: ya utiliza el cronograma vigente.
                          </p>
                        ) : (
                          <>
                            <div className="space-y-2 border-t pt-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs" htmlFor={`migration-slider-${client.id}`}>
                                  Desde cuota N.°:
                                </Label>
                                <span className="min-w-9 rounded bg-emerald-50 px-2 py-0.5 text-center text-base font-bold text-emerald-700">
                                  {migrationStart}
                                </span>
                              </div>
                              <Slider
                                id={`migration-slider-${client.id}`}
                                min={sliderMinimum}
                                max={sliderMaximum}
                                step={1}
                                value={[migrationStart]}
                                disabled={migrationActive || migrationSaving || regularInstallments.length === 0}
                                onValueChange={(values) => setMigrationStartDraft(
                                  clampMigrationStart(values[0], client.cuotas)
                                )}
                                aria-label="Cuota desde la que comienza la migración"
                              />
                              {migrationActive && (
                                <p className="text-[11px] font-medium leading-tight text-emerald-700">
                                  Inicio bloqueado. Desactive para cambiarlo.
                                </p>
                              )}
                              <p className="text-[11px] leading-tight text-slate-600">
                                {migrationStart > 1 ? `1–${migrationStart - 1}: anterior · ` : ''}
                                {migrationStart}+: nueva empresa · Inicial: anterior
                              </p>
                            </div>

                            <div className="flex justify-center border-t pt-2">
                              {migrationActive ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" disabled={migrationSaving}>
                                      Desactivar migración
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Está seguro de desactivar la migración?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Al desactivar esta opción, el cliente volverá a utilizar la configuración anterior. Esta acción puede modificar la forma en que se generan sus documentos.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => persistMigration(client, false)}>
                                        Confirmar desactivación
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => persistMigration(client, true, migrationStart)}
                                  disabled={migrationSaving || regularInstallments.length === 0}
                                >
                                  Activar migración
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="paymentDate">Fecha de pago para marcar cuotas:</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  
                  <div className="w-full">
                    <Table className="min-w-full table-fixed">
                      <TableHeader>
                        <TableRow>
                  <TableHead className="w-12 sm:w-16 text-left">N°</TableHead>
                  <TableHead className="w-36 text-left">Configuración</TableHead>
                  <TableHead className="w-28 sm:w-32 text-left">Vencimiento</TableHead>
                  <TableHead className="w-36 sm:w-36 text-left">Monto</TableHead>
                          <TableHead className="w-28 text-left">Mora</TableHead>
                          <TableHead className="w-28 text-left">Total</TableHead>
                          <TableHead className="w-36 text-left">Fecha Pago</TableHead>
                          <TableHead className="w-28 text-left">Estado</TableHead>
                          <TableHead className="w-28 text-left">Acción</TableHead>
                          <TableHead className="w-40 text-left">Voucher</TableHead>
                          <TableHead className="w-40 text-left">Boleta</TableHead>
                          <TableHead className="w-20 text-left">Editar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {client.cuotas.map((cuota, index) => {
                          const displayedMora = getEffectiveMora(cuota);
                          // Mostrar siempre monto + mora (manual o calculada) para reflejar la deuda actual
                          const totalDisplayed = cuota.monto + displayedMora;
                          const migratedInstallment = isClientMigratedInstallment(client, cuota.numero);
                          const installmentSchedule = getPaymentScheduleConfig(client, cuota.numero);
                          
                          return (
                            <TableRow key={index}>
                              <TableCell className="w-12 sm:w-16 min-w-0">
                                <Badge variant={cuota.numero === 0 ? 'secondary' : 'outline'}>
                                  {cuota.numero === 0 ? 'Inicial' : cuota.numero}
                                </Badge>
                              </TableCell>
                              <TableCell className="w-36 min-w-0">
                                <Badge variant={migratedInstallment ? 'default' : 'outline'}>
                                  {migratedInstallment
                                    ? 'Nueva empresa'
                                    : migrationEligible ? 'Configuración base' : 'Cronograma vigente'}
                                </Badge>
                                <div className="mt-1 text-xs text-slate-500">{installmentSchedule.projectName}</div>
                              </TableCell>
                              <TableCell className="w-28 sm:w-32 min-w-0">
                                {formatDate(cuota.vencimiento)}
                              </TableCell>
                              <TableCell className="w-36 sm:w-36 min-w-0 whitespace-normal sm:whitespace-nowrap">
                                <div className="flex items-center justify-start space-x-2">
                                  <span className="truncate">S/ {cuota.monto.toFixed(2)}</span>
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingCuota({ clientId: selectedClient!, type: 'amount', cuotaIndex: index }); setEditMonto(cuota.monto.toFixed(2)); }}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="w-28 whitespace-nowrap">
                                <div className="flex items-center justify-start space-x-2">
                                  <span>S/ {displayedMora.toFixed(2)}</span>
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingMora({ clientId: selectedClient!, cuotaIndex: index }); setEditMoraValue(displayedMora.toFixed(2)); }}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="w-28 whitespace-nowrap">S/ {totalDisplayed.toFixed(2)}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {cuota.fechaPago ? formatDate(cuota.fechaPago) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  cuota.estado === 'pagado' ? 'default' : 
                                  cuota.estado === 'vencido' ? 'destructive' : 'secondary'
                                }>
                                  {cuota.estado}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {cuota.estado !== 'pagado' && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleMarkAsPaid(selectedClient, index)}
                                  >
                                    Marcar Pagado
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="w-40 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <Button size="sm" variant="ghost" onClick={() => handleFileUpload(selectedClient, index, 'voucher')}>
                                    <Upload className="w-4 h-4" />
                                  </Button>
                                  {(Array.isArray(cuota.voucher) ? cuota.voucher.length > 0 : !!cuota.voucher) && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => openAllFiles(cuota.voucher)}>
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => downloadAllFiles(cuota.voucher, `voucher_${client.dni1 || 'file'}_${index}`)}>
                                        <Download className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="w-40 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <Button size="sm" variant="ghost" onClick={() => handleFileUpload(selectedClient, index, 'boleta')}>
                                    <Upload className="w-4 h-4" />
                                  </Button>
                                  {(Array.isArray(cuota.boleta) ? cuota.boleta.length > 0 : !!cuota.boleta) && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => openAllFiles(cuota.boleta)}>
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => downloadAllFiles(cuota.boleta, `boleta_${client.dni1 || 'file'}_${index}`)}>
                                        <Download className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingCuota({ clientId: selectedClient, type: 'date', cuotaIndex: index });
                                    setEditFecha(cuota.vencimiento);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de edición de montos */}
      {editingCuota && editingCuota.type === 'amount' && (
        <Dialog open={true} onOpenChange={() => setEditingCuota(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Monto de Cuotas</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nuevo monto por cuota:</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editMonto}
                  onChange={(e) => setEditMonto(e.target.value)}
                  placeholder="Ingrese el nuevo monto"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingCuota(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleEditCuotasAmount}>
                  Actualizar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de edición de fecha */}
      {editingCuota && editingCuota.type === 'date' && (
        <Dialog open={true} onOpenChange={() => setEditingCuota(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Fecha de Vencimiento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nueva fecha de vencimiento:</Label>
                <Input
                  type="date"
                  value={editFecha}
                  onChange={(e) => setEditFecha(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="propagateDates" checked={propagateDates} onCheckedChange={(v) => setPropagateDates(!!v)} />
                <Label htmlFor="propagateDates">Aplicar esta fecha a las cuotas siguientes (mensualmente)</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingCuota(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleEditCuotaDate}>
                  Actualizar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de edición de Mora por cuota */}
      {editingMora && (
        <Dialog open={true} onOpenChange={() => setEditingMora(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Mora de la Cuota</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nuevo monto de mora:</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editMoraValue}
                  onChange={(e) => setEditMoraValue(e.target.value)}
                  placeholder="Ingrese el nuevo monto de mora"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingMora(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleEditMoraSave}>
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
