import { useState } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'sonner';

export default function ProjectionView() {
  const { clients } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [rangeStart, setRangeStart] = useState<Date>(new Date());
  const [rangeEnd, setRangeEnd] = useState<Date>(new Date());
  const [showMonthlyProjections, setShowMonthlyProjections] = useState(false);

  const getMonthProjection = (date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    
    let totalCuotas = 0;
    let totalProyectado = 0;
    
    clients.forEach(client => {
      if (client.cuotas) {
        client.cuotas.forEach(cuota => {
          // Excluir iniciales (número 0) de la proyección
          if (cuota.numero > 0) {
            const vencimiento = new Date(cuota.vencimiento);
            if (vencimiento.getMonth() === month && vencimiento.getFullYear() === year) {
              totalCuotas++;
              totalProyectado += cuota.monto;
            }
          }
        });
      }
    });
    
    return { totalCuotas, totalProyectado };
  };

  // Devuelve un arreglo con desglose por mes entre startDate y endDate (inclusive)
  const getRangeProjection = (startDate: Date, endDate: Date) => {
    const rows: { year: number; month: number; monthKey: string; monthLabel: string; totalCuotas: number; totalProyectado: number }[] = [];

    // Normalizar a primer día del mes para start y último día para end
    const s = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const e = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    for (let d = new Date(s); d <= e; d.setMonth(d.getMonth() + 1)) {
      const year = d.getFullYear();
      const month = d.getMonth();
      let totalCuotas = 0;
      let totalProyectado = 0;

      clients.forEach(client => {
        client.cuotas?.forEach(cuota => {
          if (cuota.numero > 0) {
            const vencimiento = new Date(cuota.vencimiento);
            if (vencimiento.getFullYear() === year && vencimiento.getMonth() === month) {
              totalCuotas++;
              totalProyectado += cuota.monto;
            }
          }
        });
      });

      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthLabel = format(new Date(year, month, 1), 'MMMM yyyy', { locale: es });
      rows.push({ year, month, monthKey, monthLabel, totalCuotas, totalProyectado });
    }

    return rows;
  };

  const getMonthlyProjections = () => {
    const projections = [];
    const currentDate = new Date();
    
    // Empezar desde el próximo mes
    for (let i = 1; i <= 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const projection = getMonthProjection(date);
      projections.push({
        month: format(date, 'MMMM yyyy', { locale: es }),
        ...projection
      });
    }
    
    return projections;
  };

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

  const exportToPDF = async (type: 'month' | 'range' | 'monthly') => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Try to fetch and embed the logo across the top (edge-to-edge within margins)
    let titleY = 20;
    try {
      const logoData = await fetchImageAsDataURL('/logo.jpeg');
      if (logoData) {
        try {
          const imgProps = (doc as any).getImageProperties(logoData);
          const imgW = pageWidth - 20; // 10mm margin each side
          const imgH = (imgProps.height * imgW) / imgProps.width;
          doc.addImage(logoData, 'JPEG', 10, 6, imgW, imgH);
          titleY = 6 + imgH + 8;
        } catch (err) {
          console.error('Error adding logo to projection PDF:', err);
        }
      }
    } catch (err) {
      console.error('Logo fetch error', err);
    }

    // Encabezado
    doc.setFontSize(20);
    doc.text('PROYECCIÓN DE INGRESOS', pageWidth / 2, titleY, { align: 'center' });

    // Use contentStartY relative to the title/logo so content never overlaps the logo
    const contentStartY = titleY + 10;

    try {
      if (type === 'month') {
        const projection = getMonthProjection(selectedDate);
        doc.setFontSize(14);
        doc.text(`${format(selectedDate, 'MMMM yyyy', { locale: es })}`, pageWidth / 2, contentStartY, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(`Número de cuotas: ${projection.totalCuotas}`, 20, contentStartY + 16);
        doc.text(`Total proyectado: S/ ${projection.totalProyectado.toFixed(2)}`, 20, contentStartY + 26);
      } else if (type === 'range') {
        const projections = getRangeProjection(rangeStart, rangeEnd);
        doc.setFontSize(14);
        doc.text(`${format(rangeStart, 'MMMM yyyy', { locale: es })} - ${format(rangeEnd, 'MMMM yyyy', { locale: es })}`, pageWidth / 2, contentStartY, { align: 'center' });

        const tableData = projections.map(p => [
          p.monthLabel,
          p.totalCuotas.toString(),
          `S/ ${p.totalProyectado.toFixed(2)}`
        ]);

        const anyDoc = doc as jsPDF & { autoTable?: (options: any) => any };
        if (typeof anyDoc.autoTable === 'function') {
          anyDoc.autoTable({
            startY: contentStartY + 12,
            head: [['Mes', 'Núm. de Cuotas', 'Total Proyectado']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 10 }
          });
        } else {
          // fallback: draw a proper table with blue header and borders
          const pageW = pageWidth;
          const pageH = doc.internal.pageSize.getHeight();
          const margin = 10;
          const contentW = pageW - margin * 2;
          const startX = margin;
          let y = contentStartY + 12;
          const rowH = 8;

          // Column widths: 60% / 20% / 20%
          const colWidths = [contentW * 0.6, contentW * 0.2, contentW * 0.2];

          const drawHeader = () => {
            // header background
            doc.setFillColor(14, 165, 233); // blue-ish
            doc.rect(startX, y, colWidths[0] + colWidths[1] + colWidths[2], rowH, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.text('Mes', startX + 3, y + 6);
            doc.text('Número de Cuotas', startX + colWidths[0] + 3, y + 6);
            doc.text('Total Proyectado', startX + colWidths[0] + colWidths[1] + 3, y + 6);
            // header bottom border
            doc.setDrawColor(0, 0, 0);
            doc.rect(startX, y, colWidths[0] + colWidths[1] + colWidths[2], rowH, 'S');
            y += rowH;
            doc.setTextColor(0, 0, 0);
          };

          const drawRow = (row: string[]) => {
            // page break if needed
            if (y + rowH > pageH - margin) {
              doc.addPage();
              y = margin;
              drawHeader();
            }

            // draw cell borders
            let x = startX;
            for (let i = 0; i < colWidths.length; i++) {
              doc.rect(x, y, colWidths[i], rowH, 'S');
              // text
              const text = row[i] ?? '';
              doc.setFontSize(10);
              // wrap/clip long text -- use splitTextToSize for month label
              if (i === 0) {
                const lines = (doc as any).splitTextToSize(text, colWidths[i] - 6);
                for (let li = 0; li < lines.length && li < 2; li++) {
                  doc.text(lines[li], x + 3, y + 5 + li * 4);
                }
              } else {
                doc.text(text, x + 3, y + 6);
              }
              x += colWidths[i];
            }
            y += rowH;
          };

          // draw header then rows
          drawHeader();
          tableData.forEach(row => drawRow(row));
        }
      } else if (type === 'monthly') {
        const projections = getMonthlyProjections();
        doc.setFontSize(14);
        doc.text('Proyección mes a mes (próximos 12 meses)', pageWidth / 2, contentStartY, { align: 'center' });
        
        const tableData = projections.map((projection) => [
          projection.month,
          projection.totalCuotas.toString(),
          `S/ ${projection.totalProyectado.toFixed(2)}`
        ]);

        const anyDoc = doc as jsPDF & { autoTable?: (options: any) => any };
        if (typeof anyDoc.autoTable === 'function') {
          anyDoc.autoTable({
            startY: contentStartY + 12,
            head: [['Mes', 'Número de Cuotas', 'Total Proyectado']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 10 }
          });
        } else {
          let y = contentStartY + 12;
          doc.setFontSize(10);
          tableData.forEach(row => {
            doc.text(row.join(' | '), 20, y);
            y += 8;
            if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
          });
        }
      }
    } catch (err) {
      console.error('Projection export error', err);
      toast.error('Ocurrió un error al generar el PDF. Revise la consola.');
    } finally {
      try {
        doc.save(`proyeccion_${type}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast.success('PDF descargado exitosamente');
      } catch (err) {
        console.error('Error saving projection PDF', err);
        toast.error('No se pudo descargar el PDF. Revisa la consola.');
      }
    }
  };

  const monthProjection = getMonthProjection(selectedDate);
  const rangeProjection = getRangeProjection(rangeStart, rangeEnd);
  const monthlyProjections = getMonthlyProjections();

  return (
    <div className="space-y-6 w-full">
      <Card>
        <CardHeader>
          <CardTitle>Proyección de Ingresos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selección de mes */}
          <div className="flex items-center space-x-4 flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Proyección de Ingresos</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'MMMM yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex space-x-2 flex-wrap gap-2">
              <Button onClick={() => getMonthProjection(selectedDate)}>
                Ver mes
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowMonthlyProjections(!showMonthlyProjections)}
              >
                Ver proyección mes a mes
              </Button>
              <Button variant="outline" onClick={() => exportToPDF('month')}>
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* Resultados del mes seleccionado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold">{monthProjection.totalCuotas}</div>
                <p className="text-sm text-gray-600">Número de cuotas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold">S/ {monthProjection.totalProyectado.toFixed(2)}</div>
                <p className="text-sm text-gray-600">Total proyectado</p>
              </CardContent>
            </Card>
          </div>

          {/* Rango histórico */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Ver rango histórico:</h3>
            <div className="flex items-center space-x-4 mb-4 flex-wrap gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(rangeStart, 'MMMM yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeStart}
                    onSelect={(date) => date && setRangeStart(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <span>a</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(rangeEnd, 'MMMM yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeEnd}
                    onSelect={(date) => date && setRangeEnd(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Button onClick={() => getRangeProjection(rangeStart, rangeEnd)}>
                Ver rango
              </Button>
              <Button variant="outline" onClick={() => exportToPDF('range')}>
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>

            {/* Resultados del rango: desglose por mes */}
            <div className="space-y-4">
              {/** Agregado: totales del rango */}
              {(() => {
                const projections = getRangeProjection(rangeStart, rangeEnd);
                const totalCuotas = projections.reduce((s, p) => s + p.totalCuotas, 0);
                const totalProyectado = projections.reduce((s, p) => s + p.totalProyectado, 0);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-xl font-bold">{totalCuotas}</div>
                        <p className="text-sm text-gray-600">Número de cuotas (rango)</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-xl font-bold">S/ {totalProyectado.toFixed(2)}</div>
                        <p className="text-sm text-gray-600">Total proyectado (rango)</p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              <div className="w-full overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead>Número de Cuotas</TableHead>
                      <TableHead>Total Proyectado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getRangeProjection(rangeStart, rangeEnd).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.monthLabel}</TableCell>
                        <TableCell>{p.totalCuotas}</TableCell>
                        <TableCell>S/ {p.totalProyectado.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Proyección mes a mes */}
          {showMonthlyProjections && (
            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Proyección mes a mes (próximos 12 meses):</h3>
                <Button variant="outline" onClick={() => exportToPDF('monthly')}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthlyProjections.map((projection, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm mb-2">{projection.month}</h4>
                      <div className="space-y-1">
                        <div className="text-lg font-bold">{projection.totalCuotas} cuotas</div>
                        <div className="text-sm text-gray-600">S/ {projection.totalProyectado.toFixed(2)}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}