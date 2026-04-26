import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44, supabase, isSupabaseConfigured } from '@/api/base44Client';
import { getHarvestAlertDays } from '@/lib/harvestAlerts';

const AuthContext = createContext();

const settingsFallback = {
  id: 1,
  harvest_alert_days: 7,
  bypass_rls: true,
  default_ph_min: 6.5,
  default_ph_max: 8.5,
  default_temp_min: 25,
  default_temp_max: 32,
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'local-dev', public_settings: { requires_auth: false } });
  const [appSettings, setAppSettings] = useState(null);

  const refreshAppSettings = useCallback(async () => {
    try {
      const row = await base44.entities.AppSettings.get();
      setAppSettings(row);
    } catch {
      setAppSettings({ ...settingsFallback });
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await base44.auth.me();
      if (!currentUser) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }
      setUser(currentUser);
      setIsAuthenticated(true);
      await refreshAppSettings();
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setAuthError({
        type: 'unknown',
        message: error.message || 'Lỗi xác thực',
      });
    }
  }, [refreshAppSettings]);

  const checkAppState = useCallback(async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      await checkUserAuth();
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred',
      });
      setIsLoadingAuth(false);
    } finally {
      setIsLoadingPublicSettings(false);
    }
  }, [checkUserAuth]);

  useEffect(() => {
    void checkAppState();
  }, [checkAppState]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void checkUserAuth();
      }
    });
    return () => subscription.unsubscribe();
  }, [checkUserAuth]);

  const logout = useCallback(async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      await base44.auth.logout('/login');
    } else {
      await base44.auth.logout(false);
    }
  }, []);

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const harvestAlertDays = getHarvestAlertDays(appSettings);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        appSettings,
        harvestAlertDays,
        refreshAppSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
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
