# ONE · Web

Esta carpeta contiene solo la página web y el panel. Puedes usarla sin iniciar la IA/API para explorar el modo demo.

## Probar la web en VS Code

1. Extrae `ONE-web-camaras-reales-v14.zip` y abre la carpeta `ONE-web` en VS Code.
2. Abre **Terminal > Nuevo terminal**.
3. Ejecuta `npm install` y después `npm run dev:demo`. También puedes ejecutar `.\INICIAR-DEMO.cmd` desde esta misma carpeta.
4. Abre la dirección que muestre la terminal, normalmente <http://localhost:4173/>.

Necesitas Node.js. El modo demo muestra datos de ejemplo. La web ya no incluye el asistente diario que hace preguntas.

## Probar una cámara de este ordenador

Entra en **Mi ONE > Entrar sin cuenta y explorar el panel > Camera**. La página conserva la distribución de cámara grande y tarjetas inferiores. La cámara grande y cada tarjeta muestran el vídeo de las cámaras del ordenador cuando las conectas; ya no aparecen fotografías de habitaciones como sustituto de una cámara. Pulsa **Conectar cámara** o una tarjeta, acepta el permiso del navegador y usa **Desconectar** para apagarla. Al salir de Camera, todas las capturas se detienen.

Si acabas de enchufar una cámara USB, pulsa **Buscar cámaras**. Esta vista local no envía imágenes a la IA, al Hub ni a otros usuarios. El navegador necesita `localhost` o HTTPS para autorizar la cámara. En otras páginas del modo demo pueden seguir apareciendo imágenes de ejemplo.

## Conectar con la IA/API

Inicia la carpeta `ONE-IA` en otra terminal y ejecuta aquí `npm run dev` (sin `:demo`). La web llamará a <http://localhost:8000/api/v1>. Si usas otra dirección, crea `.env.local` en esta carpeta con `VITE_API_BASE_URL=http://localhost:8000/api/v1` y tu dirección real. El modo real requiere una cuenta y los permisos correspondientes.

La web y la API se comunican por HTTP. El hardware Hub, las cámaras físicas y el escáner móvil se conectan por separado; no vienen incluidos en estos ZIP.
