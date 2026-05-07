import { useAuth } from '@/context/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

interface DelinquentClient {
  client: Client;
  overdueCuotasCount: number;
  overdueCuotas: Cuota[];
  totalOverdueAmount: number;
}

export default function DelinquentClientsReport() {
  const { clients, parseLocalDate } = useAuth();

  // Calcular clientes deudores
  const getDelinquentClients = (): DelinquentClient[] => {
    if (!clients || clients.length === 0) return [];
    
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return clients
      .map((client) => {
        // Filtrar cuotas atrasadas (pendientes/vencidas y con vencimiento menor a hoy)
        const overdueCuotas = (client.cuotas || []).filter((cuota) => {
          if (cuota.numero <= 0) return false; // Excluir iniciales
          if (cuota.estado === 'pagado') return false; // Excluir pagadas

          try {
            const vencDate = parseLocalDate(cuota.vencimiento);
            const vencMid = new Date(vencDate.getFullYear(), vencDate.getMonth(), vencDate.getDate());
            return vencMid.getTime() < todayMid.getTime(); // Vencidas antes de hoy
          } catch {
            return false;
          }
        });

        return {
          client,
          overdueCuotasCount: overdueCuotas.length,
          overdueCuotas,
          totalOverdueAmount: overdueCuotas.reduce((sum, cuota) => sum + (cuota.total || cuota.monto), 0),
        };
      })
      .filter((item) => item.overdueCuotasCount >= 2) // Solo 2 o más atrasadas
      .sort((a, b) => b.overdueCuotasCount - a.overdueCuotasCount); // Ordenar por cantidad descendente
  };

  const handleDownloadReport = () => {
    try {
      const delinquent = getDelinquentClients();

      if (delinquent.length === 0) {
        toast.error('No hay clientes deudores de 2 o más cuotas para descargar.');
        return;
      }

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'A4',
      });

      // Título
      pdf.setFontSize(16);
      pdf.text('Reporte de Clientes Deudores (2+ Cuotas Atrasadas)', 14, 15);

      // Fecha de generación
      pdf.setFontSize(10);
      const today = new Date();
      const dateStr = today.toLocaleDateString('es-PE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      pdf.text(`Generado: ${dateStr}`, 14, 22);

      // Tabla con datos
      const tableData = delinquent.map((item) => [
        `${item.client.nombre1} ${item.client.nombre2 || ''}`.trim(),
        item.client.dni1,
        item.client.manzana,
        item.client.lote,
        item.overdueCuotasCount.toString(),
        `S/ ${item.totalOverdueAmount.toFixed(2)}`,
      ]);

      autoTable(pdf, {
        head: [['Cliente', 'DNI', 'Manzana', 'Lote', 'Cuotas Atrasadas', 'Monto Total']],
        body: tableData,
        startY: 28,
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 11,
        },
        bodyStyles: {
          textColor: 0,
          halign: 'left',
          fontSize: 10,
        },
        columnStyles: {
          0: { cellWidth: 60, halign: 'left' },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 20, halign: 'center' },
          4: { halign: 'center', cellWidth: 25 },
          5: { halign: 'right', cellWidth: 35 },
        },
        margin: { top: 10, right: 10, bottom: 15, left: 10 },
        didDrawPage: (data) => {
          // Footer
          const pageSize = pdf.internal.pageSize;
          const pageHeight = pageSize.getHeight();
          pdf.setFontSize(8);
          pdf.text(`Total de clientes deudores: ${delinquent.length}`, 14, pageHeight - 10);
          
          // Número de página
          const pageCount = (pdf as any).internal.getNumberOfPages?.() || 1;
          const pageNumber = data.pageNumber || 1;
          pdf.text(`Página ${pageNumber} de ${pageCount}`, pageSize.getWidth() - 25, pageHeight - 10);
        },
      });

      pdf.save('reporte_clientes_deudores.pdf');
      toast.success('Reporte descargado correctamente');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar el reporte. Intenta de nuevo.');
    }
  };

  const delinquent = getDelinquentClients();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Clientes Deudores (2+ Cuotas Atrasadas)</CardTitle>
        <Button onClick={handleDownloadReport} className="gap-2" disabled={delinquent.length === 0}>
          <Download className="w-4 h-4" />
          Descargar Reporte
        </Button>
      </CardHeader>
      <CardContent>
        {delinquent.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No hay clientes con 2 o más cuotas atrasadas.</p>
          </div>
        ) : (
          <div>
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Total de clientes deudores: <span className="font-semibold">{delinquent.length}</span>
              </p>
            </div>
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Manzana</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Celular</TableHead>
                    <TableHead className="text-center">Cuotas Atrasadas</TableHead>
                    <TableHead className="text-right">Monto Total Atrasado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delinquent.map((item) => (
                    <TableRow key={item.client.id}>
                      <TableCell className="font-medium">
                        {item.client.nombre1} {item.client.nombre2 || ''}
                      </TableCell>
                      <TableCell>{item.client.dni1}</TableCell>
                      <TableCell>{item.client.manzana}</TableCell>
                      <TableCell>{item.client.lote}</TableCell>
                      <TableCell>{item.client.celular1 || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive">{item.overdueCuotasCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        S/ {item.totalOverdueAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
