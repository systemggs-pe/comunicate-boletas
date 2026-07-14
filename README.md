# COMUNIC@TE BOLETA DE VENTA

Aplicacion independiente para emitir, consultar y verificar boletas de venta usando el mismo proyecto Firebase de COMUNIC@TE.

## Desarrollo

1. Crear `.env` a partir de `.env.example`.
2. Completar las variables `VITE_FIREBASE_*` con la configuracion de la aplicacion web de Firebase.
3. Para probar el frontend con los datos reales, configurar `VITE_BACKEND_BASE_URL=https://comunicate-boletas.netlify.app` y ejecutar `npm run dev`. La aplicacion abre en `http://localhost:5174`; si la funcion publicada aun no encuentra el DNI, Vite consulta automaticamente el backend operativo de Ventas mediante su proxy local.
4. Solo si necesitas ejecutar tambien las funciones localmente, completa `FIREBASE_API_KEY` y un `FIREBASE_SERVICE_ACCOUNT` valido del proyecto `comunicate-tacna`, en una sola linea JSON, y ejecuta `npm run dev:netlify`.

## Netlify

Crear un sitio separado con base directory apuntando a esta carpeta y configurar:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ALLOWED_EMAILS`
- `VITE_BOLETA_PUBLIC_URL`, por ejemplo `https://comunicate-boletas-extranjeras.netlify.app/boleta`
- `FIREBASE_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT`
- `OPERATIONAL_CLIENTS_URL`, por defecto `https://comunicate-registros-v2.netlify.app/api/clientes`; se usa como respaldo para hallar ventas reales por DNI
- `ALLOWED_EMAILS`
- `ALLOWED_ORIGINS`
- `RENIEC_TOKEN`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

Las variables `VITE_*` son configuracion publica del SDK web. `FIREBASE_SERVICE_ACCOUNT`, `RENIEC_TOKEN` y `GEMINI_API_KEY` deben mantenerse como secretos de Netlify.

## Firebase y lecturas

- El navegador no accede directamente a Firestore.
- El historial se pagina en grupos de 50.
- Las ventas se buscan por documento y los equipos por IMEI.
- Los duplicados se bloquean mediante `_boletaEquipoLocks/{imei}` y consultas limitadas para documentos anteriores.
- Las reglas del proyecto Firebase compartido se mantienen en la aplicacion principal y deniegan acceso web directo a boletas, contadores, emisores y locks.

## Verificacion

```powershell
npm test
npm run lint
npm run build
```
