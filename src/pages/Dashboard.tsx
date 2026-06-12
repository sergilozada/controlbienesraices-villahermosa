import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LogOut, Home, Users, TrendingUp, BarChart3, FileText, Clock, AlertTriangle, DollarSign } from 'lucide-react';
import ClientForm from '@/components/ClientForm';
import ClientList from '@/components/ClientList';
import ProjectionView from '@/components/ProjectionView';
import StatsView from '@/components/StatsView';
import DelinquentClientsReport from '@/components/DelinquentClientsReport';

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

export default function Dashboard() {
  const { user, logout, clients, searchClients } = useAuth();
  const [activeTab, setActiveTab] = useState('inicio');
  const [showNewClient, setShowNewClient] = useState(false);
  const [searchManzana, setSearchManzana] = useState('');
  const [searchLote, setSearchLote] = useState('');
  const [searchDniNombre, setSearchDniNombre] = useState('');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const { setSelectedClientId } = useAuth();

  const handleSearch = () => {
    if (!searchManzana && !searchLote && !searchDniNombre) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const results = searchClients(searchManzana, searchLote, searchDniNombre);
    setSearchResults(results);
    setShowSearchResults(true);
  };

  const clearSearch = () => {
    setSearchManzana('');
    setSearchLote('');
    setSearchDniNombre('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const getPendingPayments = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    return clients.filter(client => 
      client.cuotas?.some(cuota => {
        const vencimiento = new Date(cuota.vencimiento);
        return vencimiento.getMonth() === currentMonth && 
               vencimiento.getFullYear() === currentYear &&
               cuota.estado === 'pendiente' &&
               cuota.numero > 0; // Excluir iniciales (número 0)
      })
    );
  };

  const getOverduePayments = () => {
    const today = new Date();
    
    return clients.filter(client => 
      client.cuotas?.some(cuota => {
        const vencimiento = new Date(cuota.vencimiento);
        return vencimiento < today && 
               cuota.estado === 'pendiente' &&
               cuota.numero > 0; // Excluir iniciales (número 0)
      })
    );
  };

  const getClientStatus = (client: Client) => {
    if (!client.cuotas || client.cuotas.length === 0) return 'Sin cuotas';
    
    const cuotasPagadas = client.cuotas.filter((c: Cuota) => c.estado === 'pagado' && c.numero > 0).length;
    const totalCuotas = client.cuotas.filter((c: Cuota) => c.numero > 0).length;
    const cuotasPendientes = totalCuotas - cuotasPagadas;
    
    if (cuotasPendientes === 0) return 'Completado';
    return `Debe ${cuotasPendientes}`;
  };

  const menuItems = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'proyeccion', label: 'Proyección', icon: TrendingUp },
    { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
    { id: 'reporte', label: 'Reporte', icon: FileText },
    { id: 'pendientes', label: 'Pendientes', icon: Clock },
    { id: 'atrasados', label: 'Atrasados', icon: AlertTriangle },
    { id: 'deudores', label: 'Deudores', icon: DollarSign }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              Sistema de Bienes Raíces
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Bienvenido, {user?.username} ({user?.role})
              </span>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 mb-8">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger key={item.id} value={item.id} className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Inicio */}
          <TabsContent value="inicio">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Búsqueda de Registros</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label htmlFor="manzana">Manzana</Label>
                      <Input
                        id="manzana"
                        placeholder="Ej: A"
                        value={searchManzana}
                        onChange={(e) => setSearchManzana(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="lote">Lote</Label>
                      <Input
                        id="lote"
                        placeholder="Ej: 1"
                        value={searchLote}
                        onChange={(e) => setSearchLote(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dni-nombre">DNI o Nombre</Label>
                      <Input
                        id="dni-nombre"
                        placeholder="Opcional"
                        value={searchDniNombre}
                        onChange={(e) => setSearchDniNombre(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button onClick={handleSearch} className="flex-1">
                        Buscar
                      </Button>
                      <Button variant="outline" onClick={clearSearch}>
                        Limpiar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mb-6">
                    <Button onClick={() => setShowNewClient(true)}>
                      Nuevo Registro
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('clientes')}>
                      Ver Todos los Clientes
                    </Button>
                  </div>

                  {/* Resultados de búsqueda */}
                  {showSearchResults && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-4">
                        Resultados de búsqueda ({searchResults.length} encontrados)
                      </h3>
                      {searchResults.length > 0 ? (
                        <div className="w-full overflow-x-auto">
                          <Table className="min-w-full">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nombres</TableHead>
                                <TableHead>DNI</TableHead>
                                <TableHead>Manzana</TableHead>
                                <TableHead>Lote</TableHead>
                                <TableHead>Monto Total</TableHead>
                                <TableHead>Forma Pago</TableHead>
                                <TableHead>Estado</TableHead>
                              </TableRow>
                            </TableHeader>
                              <TableBody>
                                {searchResults.map((client) => (
                                  <TableRow key={client.id} className="cursor-pointer" onClick={() => {
                                    // Ir a la pestaña de clientes y abrir detalle
                                    setActiveTab('clientes');
                                    setSelectedClientId(client.id);
                                  }}>
                                    <TableCell>{client.nombre1} {client.nombre2}</TableCell>
                                    <TableCell>{client.dni1}</TableCell>
                                    <TableCell>{client.manzana}</TableCell>
                                    <TableCell>{client.lote}</TableCell>
                                    <TableCell>S/ {client.montoTotal.toFixed(2)}</TableCell>
                                    <TableCell>
                                      <Badge variant={client.formaPago === 'contado' ? 'default' : 'secondary'}>
                                        {client.formaPago}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{getClientStatus(client)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-gray-500">No se encontraron clientes con los criterios especificados.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Estadísticas rápidas - Eliminado el cuadro "Con Cuotas" */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-2xl font-bold">{clients.length}</div>
                    <p className="text-sm text-gray-600">Total Clientes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="text-2xl font-bold">{getPendingPayments().length}</div>
                    <p className="text-sm text-gray-600">Pendientes Este Mes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="text-2xl font-bold">{getOverduePayments().length}</div>
                    <p className="text-sm text-gray-600">Atrasados</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Clientes */}
          <TabsContent value="clientes">
            <ClientList />
          </TabsContent>

          {/* Proyección */}
          <TabsContent value="proyeccion">
            <ProjectionView />
          </TabsContent>

          {/* Estadísticas */}
          <TabsContent value="estadisticas">
            <StatsView />
          </TabsContent>

          {/* Reporte */}
          <TabsContent value="reporte">
            <StatsView showReport={true} />
          </TabsContent>

          {/* Pendientes */}
          <TabsContent value="pendientes">
            <Card>
              <CardHeader>
                <CardTitle>Cuotas Pendientes Este Mes</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientList filterType="pending" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Atrasados */}
          <TabsContent value="atrasados">
            <Card>
              <CardHeader>
                <CardTitle>Clientes con Cuotas Atrasadas</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientList filterType="overdue" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deudores */}
          <TabsContent value="deudores">
            <DelinquentClientsReport />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal para nuevo cliente */}
      {showNewClient && (
        <ClientForm onClose={() => setShowNewClient(false)} />
      )}
    </div>
  );
}
