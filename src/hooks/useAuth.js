import { useState, useEffect } from 'react';
import { authHelpers } from '../supabaseClient';
import { DEBUG } from '../utils/constants';

const buildUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.user_metadata?.name || 'Usuario',
  role: user.user_metadata?.role || null,
  createdAt: user.created_at,
  subscription: 'free',
  isGuest: false,
  isFirstLogin: false,
});

const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    let resolved = false;

    // Safety: desbloquear la app en 3s si auth se cuelga
    const fallback = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setAuthLoading(false);
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    }, 3000);

    const { data: { subscription } } = authHelpers.onAuthStateChange(
      (event, session) => {
        if (DEBUG) console.log('Auth event:', event, !!session);

        if (event === 'INITIAL_SESSION') {
          // Sesión inicial desde localStorage — sin llamada al servidor
          if (session?.user) {
            setCurrentUser(buildUser(session.user));
            setIsAuthenticated(true);
          }
          if (!resolved) {
            resolved = true;
            clearTimeout(fallback);
            setAuthLoading(false);
          }

        } else if (event === 'SIGNED_IN' && session) {
          setCurrentUser(buildUser(session.user));
          setIsAuthenticated(true);
          setAuthLoading(false);

        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setIsAuthenticated(false);
          setAuthLoading(false);

        } else if (event === 'TOKEN_REFRESHED') {
          // Token renovado automáticamente — estado ya correcto, no hacer nada
        }
      }
    );

    return () => {
      clearTimeout(fallback);
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogin = (user) => {
    const isFirstLogin = user?.isFirstLogin || false;
    // onAuthStateChange SIGNED_IN gestiona el estado de autenticación
    if (isFirstLogin) setShowOnboarding(true);
  };

  const handleLogout = () => {
    // Limpiar estado local inmediatamente — la UI responde sin esperar la red
    setCurrentUser(null);
    setIsAuthenticated(false);
    authHelpers.signOut().catch(() => {});
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
