import { useEffect } from 'react';

/**
 * Envía una notificación push cuando hay preguntas SRS pendientes.
 * Respeta un cooldown de 4h para no molestar al usuario.
 */
export default function useSRSNotifications({ dueCount, notificationsEnabled }) {
  useEffect(() => {
    if (!notificationsEnabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!dueCount) return;
    const last = parseInt(localStorage.getItem('lastSRSNotification') || '0');
    if (Date.now() - last < 4 * 60 * 60 * 1000) return;
    try {
      new Notification('PasaElTest — Repaso pendiente 🧠', {
        body: `Tienes ${dueCount} pregunta${dueCount !== 1 ? 's' : ''} por repasar hoy.`,
        icon: '/pwa-192x192.png',
        tag: 'srs-reminder',
      });
      localStorage.setItem('lastSRSNotification', Date.now().toString());
    } catch {}
  }, [dueCount, notificationsEnabled]);
}
