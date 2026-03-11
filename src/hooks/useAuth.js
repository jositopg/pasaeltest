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
    // Timeout de seguridad: si algo se cuelga, desbloquear la app en 6s
    const fallback = setTimeout(() => {
      setAuthLoading(false);
      setIsAuthenticated(false);
      setCurrentUser(null);
    }, 6000);
    try {
      // getSession() lee de localStorage — puede devolver sesión expirada
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        // Sin sesión válida — limpiar cualquier dato corrupto
        try { await supabase.auth.signOut(); } catch {}
        setCurrentUser(null);
        setIsAuthenticated(false);
        clearTimeout(fallback);
        setAuthLoading(false);
        return;
      }

      // Verificar que el token es válido haciendo una llamada real al servidor
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        // Token expirado o inválido — forzar logout limpio
        try { await supabase.auth.signOut(); } catch {}
        setCurrentUser(null);
        setIsAuthenticated(false);
        clearTimeout(fallback);
        setAuthLoading(false);
        return;
      }

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
    } catch {
      // Error inesperado — limpiar silenciosamente
      try { await supabase.auth.signOut(); } catch {}
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      clearTimeout(fallback);
      setAuthLoading(false);
    }
  };

  const handleLogin = async (user) => {
    const isFirstLogin = user?.isFirstLogin || false;
    // onAuthStateChange SIGNED_IN ya gestiona el estado — no re-llamar checkSession
    if (isFirstLogin) setShowOnboarding(true);
  };

  const handleLogout = async () => {
    // Limpiar estado local inmediatamente — la UI responde sin esperar la red
    setCurrentUser(null);
    setIsAuthenticated(false);
    // signOut en background para invalidar el token en el servidor
    if (currentUser && !currentUser.isGuest) {
      authHelpers.signOut().catch(() => {});
    }
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
