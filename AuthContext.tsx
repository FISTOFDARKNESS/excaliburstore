
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from './types';
import { githubService } from './services/githubService';

const AuthContext = createContext<AuthState & { login: (user: Partial<User>) => Promise<void>, logout: () => void } | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAdmin: false
  });

  useEffect(() => {
    const session = localStorage.getItem('ex_session');
    if (session) {
      try {
        const u = JSON.parse(session);
        githubService.getUserProfile(u.id).then(profile => {
          if (profile && !profile.user.isBanned) {
            setState({ user: profile.user, loading: false, isAdmin: profile.user.isAdmin });
          } else {
            localStorage.removeItem('ex_session');
            setState(prev => ({ ...prev, loading: false }));
          }
        });
      } catch {
        setState(prev => ({ ...prev, loading: false }));
      }
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const login = async (user: Partial<User>) => {
    const syncedUser = await githubService.syncUserProfile(user);
    setState({ user: syncedUser, loading: false, isAdmin: syncedUser.isAdmin });
    localStorage.setItem('ex_session', JSON.stringify(syncedUser));
  };

  const logout = () => {
    localStorage.removeItem('ex_session');
    setState({ user: null, loading: false, isAdmin: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
