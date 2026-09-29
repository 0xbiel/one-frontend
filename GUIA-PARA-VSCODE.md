# ONE en VS Code

## Abrir la web y navegar

1. Abre la carpeta `one-frontend` en VS Code.
2. Abre la terminal integrada.
3. Ejecuta `npm install` si las dependencias aún no están instaladas.
4. Ejecuta `npm run dev:demo`.
5. Abre la dirección que aparece en la terminal, normalmente `http://localhost:4173/`.

La página inicial explica para quién es ONE y cómo ayuda a las familias a acompañar sin vigilar continuamente. El menú lleva a **Productos**, **Cómo funciona**, **Tecnología** y **Soporte**. Cada producto abre su propia ficha. Debajo de las tarjetas hay una guía de las cuatro piezas del sistema. En las fichas del Hub y la cámara, la rueda del ratón revela el interior de los dispositivos. En el pie de las secciones originales de producto, tecnología y soporte puedes elegir las cinco variantes visuales.

En modo demo, pulsa **Entrar sin cuenta y explorar el panel** en **Iniciar sesión**. También puedes probar **Registrarse** con un nombre y correo ficticios; no se crea una cuenta real. El panel muestra datos de ejemplo. La página de Tecnología describe los avisos a la familia y una futura integración de emergencias; la demo no envía avisos externos.

## Datos reales del hub y cámaras

Para utilizar la API local, extrae por separado `ONE-IA-v12.zip` y sigue su `EMPIEZA-AQUI.md`. En esta terminal de la web, usa `npm run dev` en lugar de `npm run dev:demo`. Configura `VITE_API_BASE_URL` si el backend no está en `http://localhost:8000/api/v1`. El modo real requiere iniciar sesión; el modo demo permite probar la navegación sin dispositivos.

- **Questions & signals** lee `GET /homes/{home_id}/check-ins/questions`. La gráfica usa los tiempos de respuesta y referencias personales recibidos; la tabla muestra las preguntas, respuestas, pulso y hora reales. El hub puede enviar esos campos como `questions` en `POST /homes/{home_id}/check-ins`. Si todavía no los envía, la vista muestra un estado vacío.
- **Cámaras** usa los dispositivos registrados en el backend. El vídeo en vivo depende de LiveKit y de los permisos de cámara.
- **Home map** presenta la geometría de la API. La vista 3D se activa cuando se haya guardado un escaneo válido de RoomPlan o ARKit; el teléfono que hace el escaneo debe enviar sus datos a los endpoints de mapas del backend. Sin escaneo 3D muestra el plano 2D disponible.

En modo real, crea una cuenta con correo y contraseña de al menos 12 caracteres. Para desarrollo local, la API devuelve el código de verificación en la respuesta porque no hay un proveedor de correo configurado. El acceso posterior usa la contraseña guardada con hash PBKDF2 y un bloqueo temporal tras varios intentos fallidos. La recuperación usa un nuevo código de correo.

El escáner móvil y el hub físico no están incluidos en este proyecto. La web y la API ya tienen puntos de entrada para recibir sus datos; hasta que esos dispositivos los envíen, el modo real mostrará su estado de espera.

