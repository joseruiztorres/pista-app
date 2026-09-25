import 'react-native-url-polyfill/auto';
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, PanResponder } from 'react-native';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthProvider';
import ErrorBoundary from './src/components/ErrorBoundary';
import { colors, shape } from './src/lib/theme';
import { PistaMark } from './src/components/PistaLogo';

import LoginScreen from './src/screens/LoginScreen';
import OnboardingSportsScreen from './src/screens/OnboardingSportsScreen';
import FeedScreen from './src/screens/FeedScreen';
import CreatePostScreen from './src/screens/CreatePostScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ComingSoonScreen from './src/screens/ComingSoonScreen';
import RetosScreen from './src/screens/RetosScreen';
import BadgesScreen from './src/screens/BadgesScreen';
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
import EditPostScreen from './src/screens/EditPostScreen';
import FollowRequestsScreen from './src/screens/FollowRequestsScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import AdminReportsScreen from './src/screens/AdminReportsScreen';
import CreateStoryScreen from './src/screens/CreateStoryScreen';
import StoryViewerScreen from './src/screens/StoryViewerScreen';
import CreateHighlightScreen from './src/screens/CreateHighlightScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import RecordActivityScreen from './src/screens/RecordActivityScreen';
import CreateMenuScreen from './src/screens/CreateMenuScreen';
import StoryPrivacyScreen from './src/screens/StoryPrivacyScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import TrainingCalendarScreen from './src/screens/TrainingCalendarScreen';
import RoutesScreen from './src/screens/RoutesScreen';
import ActivityDetailScreen from './src/screens/ActivityDetailScreen';
import AthleteLevelScreen from './src/screens/AthleteLevelScreen';
import WeeklyRecapScreen from './src/screens/WeeklyRecapScreen';
import SocialChallengesScreen from './src/screens/SocialChallengesScreen';
import CreateSocialChallengeScreen from './src/screens/CreateSocialChallengeScreen';
import CelebrationOverlay from './src/components/CelebrationOverlay';
import { registerForPushNotificationsAsync } from './src/lib/pushNotifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, border: colors.line, primary: colors.accent, text: colors.text },
};

const linking = {
  prefixes: ['pista://', 'https://pista-app-five.vercel.app'],
  config: {
    screens: {
      Login: 'login', Onboarding: 'onboarding',
      Tabs: { path: '', screens: { Inicio: '', Explorar: 'explorar', Registrar: 'registrar', Quedadas: 'quedadas', Perfil: 'perfil' } },
      CrearPost: 'crear-publicacion', UserProfile: 'usuario/:profileId', PostDetail: 'publicacion/:postId',
      CreateMeetup: 'quedadas/nueva', MeetupDetail: 'quedadas/:meetupId', Conversation: 'chat/:conversationId',
      Notifications: 'notificaciones', Places: 'sitios', CreatePlace: 'sitios/nuevo', PlaceDetail: 'sitios/:placeId',
      Search: 'buscar', EditProfile: 'perfil/editar', EditPost: 'publicacion/:postId/editar', FollowRequests: 'seguimiento/solicitudes',
      AdminReports: 'admin/reportes', CreateMenu: 'crear', StoryPrivacy: 'historias/privacidad', Challenges: 'retos', Badges: 'retos/medallas',
      Progress: 'progreso', TrainingCalendar: 'calendario', Routes: 'rutas', ActivityDetail: 'actividad/:postId',
      AthleteLevel: 'nivel', WeeklyRecap: 'semana', SocialChallenges: 'retos/amigos', CreateSocialChallenge: 'retos/amigos/nuevo',
      Messages: 'mensajes', CreateStory: 'historias/nueva', StoryViewer: 'historias', CreateHighlight: 'destacados/nuevo',
    },
  },
};

// En web cargamos la tipografía de Pista (Archivo) y la aplicamos a todo el
// texto. Los iconos llevan su fuente en línea, así que no se ven afectados.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('pista-fonts')) {
  const link = document.createElement('link');
  link.id = 'pista-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..900&display=swap';
  document.head.appendChild(link);
  const style = document.createElement('style');
  style.textContent = `html, body { background: ${colors.bg}; }
html body [dir], html body input, html body textarea { font-family: 'Archivo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-stretch: 104%; }`;
  document.head.appendChild(style);
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  meta.content = colors.bg;
}

const TAB_ICONS = { Inicio: 'home', Explorar: 'compass', Registrar: 'navigate-circle', Quedadas: 'location', Perfil: 'person' };
const TAB_ORDER = ['Inicio', 'Explorar', 'Registrar', 'Quedadas', 'Perfil'];

// Botón central de la barra: un "dorsal" amarillo para registrar actividad.
function RecordTabButton({ onPress, accessibilityState }) {
  const focused = !!accessibilityState?.selected;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Registrar actividad" style={tabStyles.recordWrap}>
      <View style={[tabStyles.recordBtn, focused && tabStyles.recordBtnFocused]}>
        <Ionicons name="play" size={18} color={colors.bg} />
      </View>
      <Text style={[tabStyles.recordLabel, focused && { color: colors.accent }]}>Registrar</Text>
    </Pressable>
  );
}

const tabStyles = StyleSheet.create({
  recordWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  recordBtn: { width: 50, height: 30, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shape.button },
  recordBtnFocused: { borderWidth: 2, borderColor: colors.text },
  recordLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700' },
});

// Deslizar hacia los lados sobre cualquier pestaña cambia de pestaña, como
// en muchas apps de redes sociales. Solo reacciona a gestos claramente
// horizontales y ya avanzados (más ancho que alto, con recorrido de sobra),
// así que el scroll vertical de las listas, los chips horizontales y el
// carrusel de fotos de una publicación siguen funcionando con normalidad.
function useTabSwipe() {
  const indexRef = useRef(0);

  // En web, si dejamos que el gesto se decida en la fase de "bubble" (la
  // normal), el navegador a veces gana la carrera y arranca su selección de
  // texto nativa antes de que el PanResponder llegue a reclamar el gesto,
  // dejando el dedo/ratón "seleccionando" en vez de cambiar de pestaña.
  // Decidiéndolo en la fase de "capture" (de fuera hacia dentro, antes de
  // que el texto la vea) evitamos esa carrera, y hacemos preventDefault en
  // cuanto detectamos que es un swipe horizontal para cancelar la selección.
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_evt, gesture) => (
      Math.abs(gesture.dx) > 32 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2.5
    ),
    onMoveShouldSetPanResponderCapture: (_evt, gesture) => (
      Math.abs(gesture.dx) > 32 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2.5
    ),
    onPanResponderTerminationRequest: () => true,
    onPanResponderGrant: (evt) => {
      if (Platform.OS === 'web') evt?.preventDefault?.();
    },
    onPanResponderMove: (evt) => {
      if (Platform.OS === 'web') evt?.preventDefault?.();
    },
    onPanResponderRelease: (_evt, gesture) => {
      if (Math.abs(gesture.dx) < 60 || !navigationRef.isReady?.()) return;
      const direction = gesture.dx < 0 ? 1 : -1;
      const nextIndex = Math.min(TAB_ORDER.length - 1, Math.max(0, indexRef.current + direction));
      if (nextIndex !== indexRef.current) navigationRef.navigate(TAB_ORDER[nextIndex]);
    },
  }), []);

  // Se llama desde el listener de estado del Tab.Navigator para saber
  // desde qué pestaña partimos en cada gesto (sin provocar renders).
  const setIndex = (i) => { indexRef.current = i; };

  return { panHandlers: panResponder.panHandlers, setIndex };
}

function Tabs() {
  const swipe = useTabSwipe();
  return (
    <View
      style={Platform.OS === 'web' ? { flex: 1, touchAction: 'pan-y' } : { flex: 1 }}
      {...swipe.panHandlers}
    >
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textDim,
          tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line, height: 62, paddingTop: 6, paddingBottom: 8 },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
          tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} size={size - 4} color={color} />,
        })}
        screenListeners={{
          state: (e) => {
            const state = e.data.state;
            const name = state?.routes?.[state.index]?.name;
            const i = TAB_ORDER.indexOf(name);
            if (i >= 0) swipe.setIndex(i);
          },
        }}
      >
        <Tab.Screen name="Inicio" component={FeedScreen} />
        <Tab.Screen name="Explorar" component={ExploreScreen} />
        <Tab.Screen name="Registrar" component={RecordActivityScreen} options={{ tabBarLabel: 'Registrar', tabBarButton: (props) => <RecordTabButton {...props} /> }} />
        <Tab.Screen name="Quedadas" component={MeetupsScreen} />
        <Tab.Screen name="Perfil" component={ProfileScreen} />
      </Tab.Navigator>
    </View>
  );
}

function RootNavigator() {
  const { session, profile, loading, passwordRecovery } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'web' && session?.user?.id && profile?.onboarded) {
      registerForPushNotificationsAsync(session.user.id).catch(() => {});
    }
  }, [session, profile]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <PistaMark size={56} />
      </View>
    );
  }

  // Tiene prioridad sobre cualquier otro estado: si Supabase acaba de abrir
  // una sesión de recuperación (enlace de "olvidé mi contraseña"), primero
  // hay que dejar que elija una contraseña nueva.
  if (passwordRecovery) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
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
          <Stack.Screen name="Places" component={PlacesScreen} options={{ headerShown: true, title: 'Sitios' }} />
          <Stack.Screen name="CreatePlace" component={CreatePlaceScreen} options={{ presentation: 'modal', headerShown: true, title: 'Nuevo sitio' }} />
          <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} options={{ headerShown: true, title: 'Sitio' }} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: true, title: 'Buscar' }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal', headerShown: true, title: 'Editar perfil' }} />
          <Stack.Screen name="EditPost" component={EditPostScreen} options={{ presentation: 'modal', headerShown: true, title: 'Editar publicación' }} />
          <Stack.Screen name="FollowRequests" component={FollowRequestsScreen} options={{ headerShown: true, title: 'Solicitudes de seguimiento' }} />
          <Stack.Screen name="AdminReports" component={AdminReportsScreen} options={{ headerShown: true, title: 'Reportes' }} />
          <Stack.Screen name="CreateMenu" component={CreateMenuScreen} options={{ presentation: 'modal', headerShown: true, title: 'Crear' }} />
          <Stack.Screen name="StoryPrivacy" component={StoryPrivacyScreen} options={{ headerShown: true, title: 'Privacidad de historias' }} />
          <Stack.Screen name="Challenges" component={RetosScreen} options={{ headerShown: true, title: 'Retos' }} />
          <Stack.Screen name="Badges" component={BadgesScreen} options={{ headerShown: true, title: 'Medallas' }} />
          <Stack.Screen name="Progress" component={ProgressScreen} options={{ headerShown: true, title: 'Mi progreso' }} />
          <Stack.Screen name="TrainingCalendar" component={TrainingCalendarScreen} options={{ headerShown: true, title: 'Calendario' }} />
          <Stack.Screen name="Routes" component={RoutesScreen} options={{ headerShown: true, title: 'Mis rutas' }} />
          <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} options={{ headerShown: true, title: 'Actividad' }} />
          <Stack.Screen name="AthleteLevel" component={AthleteLevelScreen} options={{ headerShown: true, title: 'Mi nivel Pista' }} />
          <Stack.Screen name="WeeklyRecap" component={WeeklyRecapScreen} options={{ headerShown: true, title: 'Mi semana' }} />
          <Stack.Screen name="SocialChallenges" component={SocialChallengesScreen} options={{ headerShown: true, title: 'Retos con amigos' }} />
          <Stack.Screen name="CreateSocialChallenge" component={CreateSocialChallengeScreen} options={{ presentation: 'modal', headerShown: true, title: 'Nuevo reto social' }} />
          <Stack.Screen name="Messages" component={ChatListScreen} options={{ headerShown: true, title: 'Mensajes' }} />
          <Stack.Screen name="CreateStory" component={CreateStoryScreen} options={{ presentation: 'modal', headerShown: true, title: 'Nueva historia' }} />
          <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="CreateHighlight" component={CreateHighlightScreen} options={{ presentation: 'modal', headerShown: true, title: 'Nuevo destacado' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <StatusBar style="light" />
        <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
          <RootNavigator />
        </NavigationContainer>
        <CelebrationOverlay />
      </AuthProvider>
    </ErrorBoundary>
  );
}
