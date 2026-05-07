import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider as LocalAuthProvider, useAuth as useLocalAuth } from './context/AuthContext';
import { AuthProvider as FirebaseAuthProvider, useAuth as useFirebaseAuth } from './context/FirebaseAuthContext';
import Login from './pages/Login';
import FirebaseLogin from './pages/FirebaseLogin';
import Dashboard from './pages/Dashboard';
import FirebaseDashboard from './pages/FirebaseDashboard';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ErrorBoundary from '@/components/ErrorBoundary';

const queryClient = new QueryClient();

// For public access: default to LocalAuthProvider and show Dashboard without login
function ModeSelector() {
  const [mode, setMode] = useState<'local' | 'firebase'>('firebase');

  if (mode === 'local') {
    return (
      <LocalAuthProvider>
        <LocalAppContent />
      </LocalAuthProvider>
    );
  }

  return (
    <FirebaseAuthProvider>
      <FirebaseAppContent />
    </FirebaseAuthProvider>
  );
}

function LocalAppContent() {
  const { user } = useLocalAuth();
  
  if (!user) {
    return <Login />;
  }
  
  return <Dashboard />;
}

function FirebaseAppContent() {
  const { user, loading } = useFirebaseAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <FirebaseLogin />;
  }

  return <FirebaseDashboard />;
}

function WelcomeScreen() {
  const [mode, setMode] = useState<'local' | 'firebase' | null>(null);

  if (mode) {
    if (mode === 'local') {
      return (
        <LocalAuthProvider>
          <LocalAppContent />
        </LocalAuthProvider>
      );
    }
    return (
      <FirebaseAuthProvider>
        <FirebaseAppContent />
      </FirebaseAuthProvider>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-800">
            Sistema de Bienes Raíces
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Seleccione el modo de funcionamiento
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={() => setMode('firebase')} 
            className="w-full"
            size="lg"
          >
            🔥 Modo Firebase (Nube)
          </Button>
          <Button 
            onClick={() => setMode('local')} 
            variant="outline"
            className="w-full"
            size="lg"
          >
            💾 Modo Local (localStorage)
          </Button>
          
          <div className="text-xs text-gray-500 mt-4 space-y-2">
            <p><strong>Modo Firebase:</strong> Datos sincronizados en la nube, acceso desde cualquier dispositivo</p>
            <p><strong>Modo Local:</strong> Datos guardados solo en este navegador</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Default to Firebase mode (shows Firebase login if not authenticated) */}
            <Route
              path="/"
              element={
                <FirebaseAuthProvider>
                  <FirebaseAppContent />
                </FirebaseAuthProvider>
              }
            />
            {/* Keep welcome/mode selector available at /welcome */}
            <Route path="/welcome" element={<WelcomeScreen />} />
            {/* Fallback: also land on Firebase mode */}
            <Route
              path="*"
              element={
                <FirebaseAuthProvider>
                  <FirebaseAppContent />
                </FirebaseAuthProvider>
              }
            />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;