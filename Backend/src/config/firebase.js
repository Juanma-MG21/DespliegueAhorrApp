const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

// Inicialización perezosa: si FIREBASE_SERVICE_ACCOUNT no está definido el
// servidor arranca igual y solo las notificaciones push quedan deshabilitadas.
const messaging = () => {
  if (!getApps().length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT no configurado (push deshabilitado)");
    }
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  return getMessaging();
};

module.exports = { messaging };
