import { useState, useEffect } from 'react';
import { authHelpers, supabase } from '../supabaseClient';
import { DEBUG } from '../utils/constants';

const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    checkSession();

    const { data: { subscription } } = authHelpers.onAuthStateChange(
      async (event, session) => {
        if (DEBUG) console.log('Auth event:', event, session);

        if (event === 'SIGNED_IN' && session) {
          try {
            const user = session.user;
            const { data: profile } = await supabase.from('users').select('role, organization_id').eq('id', user.id).single();
            setCurrentUser({
              id: user.id,
              email: user.email,
              name: user.user_metadata?.name || 'Usuario',
              createdAt: user.created_at,
              subscription: 'free',
              role: profile?.role || 'user',
              organizationId: profile?.organization_id || null,
              isGuest: false,
              isFirstLogin: false,
            });
            setIsAuthenticated(true);
          } catch {}
          setAuthLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setIsAuthenticated(false);
          setAuthLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Token renovado — no hacer nada, el estado ya es correcto
        } else if (!session) {
          // Sesión expirada sin SIGNED_OUT explícito
          setCurrentUser(null);
          setIsAuthenticated(false);
          setAuthLoading(false);
        }
      }
    );

    return () => { subscription?.unsubscribe(); };
  }, []);

  const checkSession = async () => {
    setAuthLoading(true);
    // Timeout de seguridad: si algo se cuelga, desbloquear la app en 8s
    const fallback = setTimeout(() => setAuthLoading(false), 8000);
    try {
      // getSession() lee de localStorage sin llamada de red — rápido y offline-safe
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      if (user) {
        const { data: profile } = await supabase
          .from('users').select('role, organization_id').eq('id', user.id).single();
        setCurrentUser({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || 'Usuario',
          createdAt: user.created_at,
          subscription: 'free',
          role: profile?.role || 'user',
          organizationId: profile?.organization_id || null,
          isGuest: false,
          isFirstLogin: false,
        });
        setIsAuthenticated(true);
      }
    } catch {
      // Sesión inválida o red caída — limpiar silenciosamente
      try { await supabase.auth.signOut(); } catch {}
    } finally {
      clearTimeout(fallback);
      setAuthLoading(false);
    }
  };

  const handleLogin = async (user) => {
    const isFirstLogin = user?.isFirstLogin || false;
    try {
      await checkSession();
    } catch {}
    if (isFirstLogin) setShowOnboarding(true);
  };

  const handleLogout = async () => {
    try {
      if (currentUser && !currentUser.isGuest) {
        await authHelpers.signOut();
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleOnboardingComplete = (newProfile, updatedUser) => {
    setShowOnboarding(false);
    if (updatedUser) setCurrentUser(updatedUser);
    return newProfile;
  };

  return {
    isAuthenticated,
    currentUser,
    setCurrentUser,
    authLoading,
    showOnboarding,
    setShowOnboarding,
    handleLogin,
    handleLogout,
    handleOnboardingComplete,
  };
};

export default useAuth;
