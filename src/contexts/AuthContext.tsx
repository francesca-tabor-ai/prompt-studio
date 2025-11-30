import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  authService,
  AuthState,
  UserProfile,
  Role,
  LoginCredentials,
  RegisterData,
} from '../services/authService';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ error: Error | null }>;
  register: (data: RegisterData) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    roles: [],
    permissions: [],
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const loadUserData = async (user: User) => {
    try {
      const profilePromise = authService.getUserProfile(user.id).catch(() => null);
      const rolesPromise = authService.getUserRoles(user.id).catch(() => []);
      const permissionsPromise = authService.getUserPermissions(user.id).catch(() => []);

      const [profile, roles, permissions] = await Promise.all([
        profilePromise,
        rolesPromise,
        permissionsPromise,
      ]);

      return { profile, roles, permissions };
    } catch (error) {
      console.error('Error loading user data:', error);
      return {
        profile: null,
        roles: [],
        permissions: [],
      };
    }
  };

  const initializeAuth = async () => {
    const timeoutId = setTimeout(() => {
      console.warn('Auth initialization timeout - stopping load');
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }, 3000);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setAuthState({
          user: session.user,
          profile: null,
          roles: [],
          permissions: [],
          session,
          isLoading: false,
          isAuthenticated: true,
        });

        loadUserData(session.user).then(({ profile, roles, permissions }) => {
          setAuthState((prev) => ({
            ...prev,
            profile,
            roles,
            permissions,
          }));
        }).catch((error) => {
          console.error('Failed to load user data:', error);
        });
      } else {
        setAuthState({
          user: null,
          profile: null,
          roles: [],
          permissions: [],
          session: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      setAuthState({
        user: null,
        profile: null,
        roles: [],
        permissions: [],
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { profile, roles, permissions } = await loadUserData(session.user);

          setAuthState({
            user: session.user,
            profile,
            roles,
            permissions,
            session,
            isLoading: false,
            isAuthenticated: true,
          });
        } else if (event === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            profile: null,
            roles: [],
            permissions: [],
            session: null,
            isLoading: false,
            isAuthenticated: false,
          });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setAuthState((prev) => ({
            ...prev,
            session,
          }));
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<{ error: Error | null }> => {
    const { session, error } = await authService.login(credentials);

    if (error) {
      return { error };
    }

    if (session?.user) {
      const { profile, roles, permissions } = await loadUserData(session.user);

      setAuthState({
        user: session.user,
        profile,
        roles,
        permissions,
        session,
        isLoading: false,
        isAuthenticated: true,
      });
    }

    return { error: null };
  };

  const register = async (data: RegisterData): Promise<{ error: Error | null }> => {
    const { error } = await authService.register(data);
    return { error };
  };

  const logout = async () => {
    await authService.logout();
    setAuthState({
      user: null,
      profile: null,
      roles: [],
      permissions: [],
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });
  };

  const hasPermission = (permission: string): boolean => {
    return authState.permissions.includes(permission);
  };

  const hasRole = (role: string): boolean => {
    return authState.roles.some((r) => r.name === role);
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<{ error: Error | null }> => {
    if (!authState.user) {
      return { error: new Error('No user logged in') };
    }

    const { error } = await authService.updateProfile(authState.user.id, updates);

    if (!error) {
      const updatedProfile = await authService.getUserProfile(authState.user.id);
      setAuthState((prev) => ({
        ...prev,
        profile: updatedProfile,
      }));
    }

    return { error };
  };

  const refreshAuth = async () => {
    if (authState.user) {
      const { profile, roles, permissions } = await loadUserData(authState.user);
      setAuthState((prev) => ({
        ...prev,
        profile,
        roles,
        permissions,
      }));
    }
  };

  const value: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    hasPermission,
    hasRole,
    updateProfile,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
