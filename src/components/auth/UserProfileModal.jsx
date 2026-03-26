import React, { useState } from 'react';
import Icons from '../common/Icons';

function UserProfileModal({ user, profile, onClose, onLogout, onUpdateProfile }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    oposicion: user?.oposicion || profile?.examName || '',
  });

  const isAcademy = user?.role === 'academy';

  const handleSave = async () => {
    const updatedProfile = { ...profile, name: formData.name, examName: formData.oposicion };
    onUpdateProfile(updatedProfile);
    setEditing(false);
  };

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que quieres cerrar sesión?')) {
      onLogout();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-800 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold text-xl">Mi Perfil</h2>
          <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors">
            <Icons.X />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
          {/* Avatar + rol */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-3xl font-bold text-white">
              {isAcademy ? '🎓' : user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isAcademy
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {isAcademy ? '🎓 Academia' : 'Estudiante'}
              </span>
            </div>
          </div>

          {/* Info fields */}
          <div className="space-y-4">
            {/* Nombre — igual para todos */}
            <div>
              <label className="block text-gray-400 text-xs mb-1">Nombre</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-blue-500 outline-none"
                />
              ) : (
                <p className="text-white font-medium">{user?.name}</p>
              )}
            </div>

            {/* Email — igual para todos */}
            <div>
              <label className="block text-gray-400 text-xs mb-1">Email</label>
              <p className="text-white font-medium">{user?.email}</p>
            </div>

            {/* Campo específico por rol */}
            {isAcademy ? (
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-0.5">Tipo de cuenta</p>
                <p className="text-blue-100 text-sm">Academia / Centro formativo</p>
                <p className="text-blue-400/70 text-xs mt-1">
                  Puedes crear planes de estudio y compartirlos con tus alumnos
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-gray-400 text-xs mb-1">¿Qué estudias?</label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.oposicion}
                    onChange={(e) => setFormData({ ...formData, oposicion: e.target.value })}
                    placeholder="Ej: Inglés B2, Historia, Anatomía..."
                    className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-blue-500 outline-none placeholder-gray-600"
                  />
                ) : (
                  <p className="text-white font-medium">{user?.oposicion || profile?.examName || '—'}</p>
                )}
              </div>
            )}

            {/* Miembro desde */}
            <div>
              <label className="block text-gray-400 text-xs mb-1">Miembro desde</label>
              <p className="text-white font-medium">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
                  : '—'}
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
                  Guardar cambios
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
                Editar perfil
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full bg-red-500/10 text-red-400 border border-red-500/30 font-semibold py-3 rounded-xl hover:bg-red-500/20 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfileModal;
