# Pista

App Expo para iOS, Android y web, conectada a Supabase.

## Ejecutar y compilar

1. Copia `.env.example` a `.env` y rellena `EXPO_PUBLIC_SUPABASE_URL` y
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` con la URL y la clave pública (anon) de
   Supabase. Nunca uses la `service_role` en la app.
2. Ejecuta `npm ci` y luego `npm run web` para desarrollo.
3. Ejecuta `npm run build` para generar la web estática en `dist/`.

## Vercel

Importa este repositorio como proyecto. `vercel.json` fija el comando de
compilación y el directorio `dist`. En los ajustes del proyecto configura las
dos variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`
para Production y Preview **antes de desplegar**. Expo incorpora sus valores
en el JavaScript durante la compilación; cambiar una variable exige un nuevo
despliegue. La clave `anon` es pública, así que el acceso a los datos depende
de las políticas RLS de Supabase.
