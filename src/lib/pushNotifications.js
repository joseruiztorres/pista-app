// Registro de push nativas (Expo Push Tokens). En la web (despliegue actual en
// Vercel) esto no hace nada: solo se activa cuando la app corre como app nativa
// instalada via EAS Build. Ver supabase/005_notifications.sql (tabla push_tokens).
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { reminderKey } from './motivation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(userId) {
  if (Platform.OS === 'web' || !userId) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
  const token = tokenResponse?.data;
  if (!token) return null;

  await supabase.from('push_tokens').upsert({ profile_id: userId, token }, { onConflict: 'profile_id,token' });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return token;
}

export async function scheduleSmartReminder(userId, motivation) {
  if (Platform.OS === 'web' || !userId || !motivation) return null;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return null;
  const key = reminderKey(userId);
  if (await AsyncStorage.getItem(key)) return null;
  const when = new Date();
  when.setHours(20, 0, 0, 0);
  if (when.getTime() <= Date.now() + 10 * 60000) {
    when.setDate(when.getDate() + 1);
    when.setHours(18, 30, 0, 0);
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: motivation.title, body: motivation.text, data: { screen: motivation.target } },
    trigger: when,
  });
  await AsyncStorage.setItem(key, id || 'scheduled');
  return id;
}
