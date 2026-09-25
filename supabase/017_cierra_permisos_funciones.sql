-- Refuerzo de seguridad: en las migraciones 015 y 016 restringimos
-- delete_own_account() y deactivate_own_account() a "authenticated" con
-- "revoke all ... from public". Comprobado en producción, el rol "anon"
-- (visitante sin sesión) seguía pudiendo llamarlas -- probablemente por
-- privilegios por defecto de este proyecto que conceden EXECUTE a "anon" en
-- funciones nuevas del esquema public, aparte del "public" pseudo-rol.
--
-- No ha sido explotable: sin sesión, auth.uid() es NULL y ninguna fila tiene
-- id = NULL, así que las llamadas anónimas no tocaban ningún dato. Aun así,
-- cerramos el permiso explícitamente para que solo usuarios con sesión
-- puedan ejecutarlas, como estaba previsto.
revoke execute on function public.delete_own_account() from anon;
revoke execute on function public.deactivate_own_account() from anon;

-- Nos aseguramos también de que siga concedido a quien sí debe tenerlo.
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.deactivate_own_account() to authenticated;
