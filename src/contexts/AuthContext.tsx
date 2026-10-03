import React, { createContext, useContext, useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { User, UserRole } from '../types';
import { api, getStoredToken, setStoredToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isOnline: boolean;
  mustChangePassword: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; mustChangePassword?: boolean; message?: string }>;
  register: (data: {
    fullName: string;
    email: string;
    employeeId: string;
    phoneNumber?: string;
    role?: string;
    department?: string;
    teamId?: string;
    projectIds?: string[];
    roleTitle?: string;
    password: string;
    confirmPassword?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  switchPersona: (role?: UserRole, email?: string) => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshUser = async () => {
    try {
      const stored = getStoredToken();
      if (!stored) {
        // No stored session - present clean login screen
        setUser(null);
        setToken(null);
        setMustChangePassword(false);
        return;
      }
      const data = await api.getMe();
      if (data.success && data.user) {
        setUser(data.user);
        setMustChangePassword(Boolean(data.user.mustChangePassword));
      } else {
        setStoredToken(null);
        setToken(null);
        setUser(null);
        setMustChangePassword(false);
      }
    } catch (_err) {
      // Clear expired or invalid session token quietly
      setStoredToken(null);
      setToken(null);
      setUser(null);
      setMustChangePassword(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (identifier: string, password: string, rememberMe?: boolean) => {
    setIsLoading(true);
    try {
      const res = await api.login(identifier, password, rememberMe);
      await Swal.fire({
        icon: 'success',
        title: 'Sign-in successful',
        text: res.mustChangePassword
          ? 'Your temporary password must be changed before continuing.'
          : `Welcome, ${res.user.fullName}.`,
        confirmButtonText: 'Continue',
        confirmButtonColor: '#04446F'
      });
      setStoredToken(res.token);
      setToken(res.token);
      setUser(res.user);
      setMustChangePassword(Boolean(res.mustChangePassword));
      return {
        success: true,
        mustChangePassword: Boolean(res.mustChangePassword),
        message: res.mustChangePassword ? 'Temporary password detected. Please change your password.' : 'Login successful'
      };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    fullName: string;
    email: string;
    employeeId: string;
    phoneNumber?: string;
    role?: string;
    department?: string;
    teamId?: string;
    roleTitle?: string;
    password: string;
    confirmPassword?: string;
  }) => {
    await api.register(data);
  };

  const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    setIsLoading(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword, confirmPassword);
      setStoredToken(res.token);
      setToken(res.token);
      setUser(res.user);
      setMustChangePassword(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore network errors on logout
    }
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
  };

  const switchPersona = async (role?: UserRole, email?: string) => {
    setIsLoading(true);
    try {
      const res = await api.switchPersona(role, email);
      setStoredToken(res.token);
      setToken(res.token);
      setUser(res.user);
      setMustChangePassword(Boolean(res.user.mustChangePassword));
    } finally {
      setIsLoading(false);
    }
  };

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!user) return false;
    if (['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER'].includes(user.role)) return true;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isOnline,
        mustChangePassword,
        login,
        register,
        logout,
        changePassword,
        switchPersona,
        hasRole,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
