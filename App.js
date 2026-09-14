import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthProvider';
import { colors } from './src/lib/theme';

import LoginScreen from './src/screens/LoginScreen';
import OnboardingSportsScreen from './src/screens/OnboardingSportsScreen';
import FeedScreen from './src/screens/FeedScreen';
import CreatePostScreen from './src/screens/CreatePostScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ComingSoonScreen from './src/screens/ComingSoonScreen';
import RetosScreen from './src/screens/RetosScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import MeetupsScreen from './src/screens/MeetupsScreen';
import CreateMeetupScreen from './src/screens/CreateMeetupScreen';
import MeetupDetailScreen from './src/screens/MeetupDetailScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatScreen from './src/screens/ChatScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import PlacesScreen from './src/screens/PlacesScreen';
import CreatePlaceScreen from './src/screens/CreatePlaceScreen';
import PlaceDetailScreen from './src/screens/PlaceDetailScreen';
import SearchScreen from './src/screens/SearchScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import { registerForPushNotificationsAsync } from './src/lib/pushNotifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, border: colors.line, primary: colors.accent, text: colors.text },
};

const TAB_ICONS = { Feed: 'home', Retos: 'trophy', Quedadas: 'location', Chat: 'chatbubble-ellipses', Perfil: 'person' };

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} size={size - 4} color={color} />,
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Retos" component={RetosScreen} />
      <Tab.Screen name="Quedadas" component={MeetupsScreen} />
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'web' && session?.user?.id && profile?.onboarded) {
      registerForPushNotificationsAsync(session.user.id).catch(() => {});
    }
  }, [session, profile]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : !profile?.onboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingSportsScreen} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="CrearPost" component={CreatePostScreen} options={{ presentation: 'modal', headerShown: true, title: 'Nueva publicación' }} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: true, title: 'Perfil' }} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ headerShown: true, title: 'Publicación' }} />
          <Stack.Screen name="CreateMeetup" component={CreateMeetupScreen} options={{ presentation: 'modal', headerShown: true, title: 'Nueva quedada' }} />
          <Stack.Screen name="MeetupDetail" component={MeetupDetailScreen} options={{ headerShown: true, title: 'Quedada' }} />
          <Stack.Screen name="Conversation" component={ChatScreen} options={{ headerShown: true, title: 'Chat' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, title: 'Notificaciones' }} />
          <Stack.Screen name="Places" component={PlacesScreen} />
          <Stack.Screen name="CreatePlace" component={CreatePlaceScreen} options={{ presentation: 'modal', headerShown: true, title: 'Nuevo sitio' }} />
          <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} options={{ headerShown: true, title: 'Sitio' }} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal', headerShown: true, title: 'Editar perfil' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
