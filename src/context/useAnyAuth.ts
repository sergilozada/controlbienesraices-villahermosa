import { useOptionalAuth as useOptionalFirebaseAuth } from './FirebaseAuthContext';
import { useOptionalAuth as useOptionalLocalAuth } from './AuthContext';

export default function useAnyAuth() {
  const firebaseAuth = useOptionalFirebaseAuth();
  const localAuth = useOptionalLocalAuth();
  const context = firebaseAuth ?? localAuth;

  if (!context) {
    throw new Error('No AuthProvider found (neither Firebase nor Local).');
  }

  return context;
}

