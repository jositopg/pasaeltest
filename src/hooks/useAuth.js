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
          setAuthLoading(false);
        } else if (event === 'SIGNED_OUT') {
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
    const { user } = await authHelpers.getUser();

    if (user) {
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
    }

    setAuthLoading(false);
  };

  const handleLogin = async (user) => {
    // Re-fetch desde DB para obtener role y datos actualizados,
    // independientemente de lo que traiga el objeto del formulario.
    const isFirstLogin = user?.isFirstLogin || false;
    await checkSession();
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
