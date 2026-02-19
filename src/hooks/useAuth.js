import { useState, useEffect } from 'react';
import { authHelpers } from '../supabaseClient';
import { DEBUG } from '../utils/constants';

/**
 * Hook para gestionar autenticación con Supabase
 */
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
          const user = session.user;
          setCurrentUser({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || 'Usuario',
            oposicion: user.user_metadata?.oposicion || 'Sin especificar',
            subscription: 'free',
            isGuest: false,
            isFirstLogin: false
          });
          setIsAuthenticated(true);
          setAuthLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setIsAuthenticated(false);
          setAuthLoading(false);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    setAuthLoading(true);
    const { user } = await authHelpers.getUser();
    
    if (user) {
      setCurrentUser({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || 'Usuario',
        oposicion: user.user_metadata?.oposicion || 'Sin especificar',
        subscription: 'free',
        isGuest: false,
        isFirstLogin: false
      });
      setIsAuthenticated(true);
    }
    
    setAuthLoading(false);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    if (user.isFirstLogin) {
      setShowOnboarding(true);
    }
  };

  const handleLogout = async () => {
    try {
      if (currentUser && !currentUser.isGuest) {
        await authHelpers.signOut();
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
    // Always clean up local state
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleOnboardingComplete = (newProfile, updatedUser) => {
    setShowOnboarding(false);
    if (updatedUser) {
      setCurrentUser(updatedUser);
    }
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
