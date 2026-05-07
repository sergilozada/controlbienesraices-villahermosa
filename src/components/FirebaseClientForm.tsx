import { useState } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ClientFormProps {
  onClose: () => void;
}

export default function FirebaseClientForm({ onClose }: ClientFormProps) {
  const { addClient } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre1: '',
    nombre2: '',
    dni1: '',
    dni2: '',
    celular1: '',
    celular2: '',
    email1: '',
    email2: '',
    manzana: '',
    lote: '',
    metraje: '',
    montoTotal: '',
    formaPago: '',
    numeroCuotas: '',
    inicial: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.nombre1 || !formData.dni1 || !formData.manzana || !formData.lote || !formData.montoTotal || !formData.formaPago) {
      toast.error('Por favor complete todos los campos obligatorios');
      return;
    }

    if (!formData.numeroCuotas) {
      toast.error('Debe especificar el número de cuotas');
      return;
    }

    if (formData.formaPago === 'cuotas' && !formData.inicial) {
      toast.error('Para pagos en cuotas debe especificar la inicial');
      return;
    }

    setLoading(true);

    const clientData = {
      nombre1: formData.nombre1,
      nombre2: formData.nombre2 || undefined,
      dni1: formData.dni1,
      dni2: formData.dni2 || undefined,
      celular1: formData.celular1 || undefined,
      celular2: formData.celular2 || undefined,
      email1: formData.email1 || undefined,
      email2: formData.email2 || undefined,
      manzana: formData.manzana,
      lote: formData.lote,
      metraje: parseFloat(formData.metraje) || 0,
      montoTotal: parseFloat(formData.montoTotal),
      formaPago: formData.formaPago as 'contado' | 'cuotas',
      numeroCuotas: parseInt(formData.numeroCuotas),
      inicial: formData.formaPago === 'cuotas' ? parseFloat(formData.inicial) : 0
    };

    try {
      const success = await addClient(clientData);
      if (success) {
        toast.success('Cliente registrado exitosamente');
        onClose();
      } else {
        toast.error('Ya existe un cliente registrado con esa manzana y lote');
      }
    } catch (error) {
      toast.error('Error al registrar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Registro de Cliente (Firebase)</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nombre1">Nombre 1 *</Label>
              <Input
                id="nombre1"
                value={formData.nombre1}
                onChange={(e) => handleInputChange('nombre1', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="nombre2">Nombre 2</Label>
              <Input
                id="nombre2"
                value={formData.nombre2}
                onChange={(e) => handleInputChange('nombre2', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dni1">DNI 1 *</Label>
              <Input
                id="dni1"
                value={formData.dni1}
                onChange={(e) => handleInputChange('dni1', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="dni2">DNI 2</Label>
              <Input
                id="dni2"
                value={formData.dni2}
                onChange={(e) => handleInputChange('dni2', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="celular1">Celular 1</Label>
              <Input
                id="celular1"
                value={formData.celular1}
                onChange={(e) => handleInputChange('celular1', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="celular2">Celular 2</Label>
              <Input
                id="celular2"
                value={formData.celular2}
                onChange={(e) => handleInputChange('celular2', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email1">Email 1</Label>
              <Input
                id="email1"
                type="email"
                value={formData.email1}
                onChange={(e) => handleInputChange('email1', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email2">Email 2</Label>
              <Input
                id="email2"
                type="email"
                value={formData.email2}
                onChange={(e) => handleInputChange('email2', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="manzana">Manzana *</Label>
              <Input
                id="manzana"
                value={formData.manzana}
                onChange={(e) => handleInputChange('manzana', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="lote">Lote *</Label>
              <Input
                id="lote"
                value={formData.lote}
                onChange={(e) => handleInputChange('lote', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="metraje">Metraje (m²)</Label>
              <Input
                id="metraje"
                type="number"
                step="0.01"
                value={formData.metraje}
                onChange={(e) => handleInputChange('metraje', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="montoTotal">Monto Total *</Label>
              <Input
                id="montoTotal"
                type="number"
                step="0.01"
                value={formData.montoTotal}
                onChange={(e) => handleInputChange('montoTotal', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="formaPago">Forma de Pago *</Label>
              <Select value={formData.formaPago} onValueChange={(value) => handleInputChange('formaPago', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar forma de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contado">Contado</SelectItem>
                  <SelectItem value="cuotas">Cuotas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="numeroCuotas">Número de Cuotas *</Label>
              <Input
                id="numeroCuotas"
                type="number"
                value={formData.numeroCuotas}
                onChange={(e) => handleInputChange('numeroCuotas', e.target.value)}
                required
              />
            </div>
            {formData.formaPago === 'cuotas' && (
              <div>
                <Label htmlFor="inicial">Inicial *</Label>
                <Input
                  id="inicial"
                  type="number"
                  step="0.01"
                  value={formData.inicial}
                  onChange={(e) => handleInputChange('inicial', e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}