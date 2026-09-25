import { Alert, Platform } from 'react-native';

// Alert.alert de React Native no está implementado en la versión web
// (react-native-web no lo soporta), así que ahí los diálogos de confirmación
// y de error se quedan mudos: el usuario pulsa "Eliminar" y no pasa nada, sin
// aviso de error ni confirmación real (audit #9).
//
// Este wrapper tiene la misma firma que Alert.alert (title, message, buttons)
// y respeta los mismos botones y callbacks onPress que ya usa el resto de la
// app: en nativo delega directamente en Alert.alert; en web usa
// window.alert/window.confirm.
export function alert(title, message, buttons) {
  if (Platform.OS !== 'web') {
    return Alert.alert(title, message, buttons);
  }
  const text = [title, message].filter(Boolean).join('\n\n');
  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }
  if (buttons.length === 1) {
    window.alert(text);
    buttons[0].onPress && buttons[0].onPress();
    return;
  }
  // Dos o más botones: usamos confirm (Aceptar/Cancelar). El botón 'cancel'
  // es el que cierra sin hacer nada; el resto se trata como confirmación.
  const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[buttons.length - 1];
  const confirmBtn = buttons.find((b) => b !== cancelBtn) || buttons[0];
  const ok = window.confirm(text);
  if (ok) {
    confirmBtn.onPress && confirmBtn.onPress();
  } else {
    cancelBtn.onPress && cancelBtn.onPress();
  }
}
