INVENTARIO DE TRAILERS - VERSION RENDER 2.1

Correccion: se elimino better-sqlite3 para evitar el cierre status 134 en Render.
Esta version usa almacenamiento JSON + fotos y no requiere modulos nativos.

Render:
Build Command: npm install
Start Command: npm start
Health Check Path opcional: /health

IMPORTANTE:
En el plan gratuito de Render, los archivos locales pueden perderse tras reinicios o nuevos despliegues.
Para uso permanente, agrega un Persistent Disk y configura la variable DATA_DIR con la ruta montada (por ejemplo /var/data).
