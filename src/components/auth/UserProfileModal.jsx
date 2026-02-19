import React, { useState } from 'react';
import Icons from '../common/Icons';
import { GRADIENT_BG } from '../../utils/constants';

function UserProfileModal({ user, profile, onClose, onLogout, onUpdateProfile }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    oposicion: user?.oposicion || profile?.examName || ''
  });

  const handleSave = async () => {
    const updatedUser = { ...user, ...formData };
    await storage.set('current-user', updatedUser);
    
    const users = await storage.get('users') || [];
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
      await storage.set('users', users);
    }

    const updatedProfile = { ...profile, name: formData.name, examName: formData.oposicion };
    await storage.set('user-profile', updatedProfile);
    
    onUpdateProfile(updatedProfile);
    setEditing(false);
  };

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que quieres cerrar sesión?')) {
      await storage.set('user-session', null);
      onLogout();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-white/10 rounded-3xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-bold text-xl">Mi Perfil</h2>
          <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors">
            <Icons.X />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-4xl font-bold text-white mb-3">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              user?.subscription === 'premium' 
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {user?.subscription === 'premium' ? '👑 Premium' : 'Free'}
            </span>
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Nombre</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                />
              ) : (
                <p className="text-white font-medium">{user?.name}</p>
              )}
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1">Email</label>
              <p className="text-white font-medium">{user?.email}</p>
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1">Oposición</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.oposicion}
                  onChange={(e) => setFormData({...formData, oposicion: e.target.value})}
                  className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                />
              ) : (
                <p className="text-white font-medium">{user?.oposicion || profile?.examName}</p>
              )}
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1">Miembro desde</label>
              <p className="text-white font-medium">
                {new Date(user?.createdAt).toLocaleDateString('es-ES', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="w-full bg-blue-500 text-white font-semibold py-3 rounded-xl hover:bg-blue-600 transition-colors"
                >
                  Guardar Cambios
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="w-full bg-white/5 text-white py-3 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full bg-blue-500 text-white font-semibold py-3 rounded-xl hover:bg-blue-600 transition-colors"
              >
                Editar Perfil
              </button>
            )}
            
            <button
              onClick={handleLogout}
              className="w-full bg-red-500/10 text-red-400 border border-red-500/30 font-semibold py-3 rounded-xl hover:bg-red-500/20 transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default UserProfileModal;
