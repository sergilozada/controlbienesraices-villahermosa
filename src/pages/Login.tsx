import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (login(username, password)) {
      // El login exitoso será manejado por el componente padre
    } else {
      setError('Usuario o contraseña incorrectos');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      // background image: prefer public/login-bg.jpg; if missing, gradient fallback in child
      style={{
        backgroundImage: `url('/login-bg.jpeg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness(1.08)'
      }}
    >
  {/* subtle overlay for readability (very light) */}
  <div className="absolute inset-0 bg-black/5 pointer-events-none"></div>
      <div className="w-full max-w-md relative">
        <Card className="shadow-xl bg-white/95">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-800">
              Sistema de Bienes Raíces
            </CardTitle>
            <CardDescription>
              Ingrese sus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingrese su usuario"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full">
                Iniciar Sesión
              </Button>
            </form>
            
            {/* Test accounts UI removed to avoid exposing credentials */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}