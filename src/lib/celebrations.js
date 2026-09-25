import AsyncStorage from '@react-native-async-storage/async-storage';

function storageKey(profileId) {
  return `@pista:celebrations:${profileId}`;
}

export async function queueCelebrations(profileId, items = []) {
  if (!profileId || !items.length) return;
  const key = storageKey(profileId);
  let current = [];
  try { current = JSON.parse(await AsyncStorage.getItem(key) || '[]'); } catch { current = []; }
  const seen = new Set(current.map((item) => `${item.type}:${item.id}`));
  items.forEach((item) => {
    const id = `${item.type}:${item.id}`;
    if (!seen.has(id)) { current.push(item); seen.add(id); }
  });
  await AsyncStorage.setItem(key, JSON.stringify(current.slice(-12)));
}

export async function takeNextCelebration(profileId) {
  if (!profileId) return null;
  const key = storageKey(profileId);
  let current = [];
  try { current = JSON.parse(await AsyncStorage.getItem(key) || '[]'); } catch { current = []; }
  const next = current.shift() || null;
  await AsyncStorage.setItem(key, JSON.stringify(current));
  return next;
}
