import { useAuth as useFirebaseAuth } from './FirebaseAuthContext';
import { useAuth as useLocalAuth } from './AuthContext';

export default function useAnyAuth() {
  // Try firebase first, if it throws because there's no provider, fall back to local
  try {
    return useFirebaseAuth();
  } catch (e) {
    try {
      return useLocalAuth();
    } catch (e2) {
      console.trace('useAnyAuth: no auth provider available');
      throw new Error('No AuthProvider found (neither Firebase nor Local). Make sure your app wraps components with a provider.');
    }
  }
}
