// --- AuthContext ---
// Autenticação Firebase + perfil do Firestore (collection 'usuarios').
// Provê login/logout e dados do usuário logado para toda a aplicação.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  role: 'admin' | 'gestor' | 'visualizador';
  ativo: boolean;
}

interface AuthContextType {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isGestor: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
          if (snap.exists() && snap.data().ativo === true) {
            setUsuario({ uid: firebaseUser.uid, ...snap.data() } as Usuario);
          } else {
            // Usuário inativo ou sem perfil — deslogar
            await signOut(auth);
            setUsuario(null);
          }
        } catch (e) {
          console.error('[Auth] Erro ao buscar perfil:', e);
          setUsuario(null);
        }
      } else {
        setUsuario(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function login(email: string, senha: string) {
    await signInWithEmailAndPassword(auth, email, senha);
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        loading,
        login,
        logout,
        isAdmin: usuario?.role === 'admin',
        isGestor: usuario?.role === 'admin' || usuario?.role === 'gestor',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
