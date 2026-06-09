import { useState } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff } from 'lucide-react';

export default function FirebaseLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const success = await login(email, password);
      if (!success) {
        setError('Email o contraseña incorrectos');
      }
    } catch (error) {
      console.error('Firebase login error:', error);
      setError('Error al iniciar sesión. Revise la consola para más detalles.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userType: 'admin' | 'usuario' | 'readonly') => {
    const credentials = {
      admin: {
        email: import.meta.env.VITE_ADMIN_EMAIL || '',
        password: import.meta.env.VITE_ADMIN_PASSWORD || '',
      },
      usuario: {
        email: import.meta.env.VITE_USUARIO_EMAIL || '',
        password: import.meta.env.VITE_USUARIO_PASSWORD || '',
      },
      readonly: {
        email: import.meta.env.VITE_READONLY_EMAIL || '',
        password: import.meta.env.VITE_READONLY_PASSWORD || '',
      },
    };
    
    setEmail(credentials[userType].email);
    setPassword(credentials[userType].password);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url('/login-bg.jpeg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness(1.08)'
      }}
    >
      <div className="absolute inset-0 bg-black/5 pointer-events-none"></div>
      <div className="w-full max-w-md relative">
          {/* Backdrop blur and semi-transparent card */}
          <Card className="shadow-xl bg-white/30 backdrop-blur-md border border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-800">
              Sistema de Bienes Raíces
            </CardTitle>
            <CardDescription>
              Ingrese sus credenciales para acceder al sistema con Firebase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ingrese su email"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingrese su contraseña"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>
            
            {/* Removed public test accounts UI to avoid exposing credentials */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}