INVENTARIO DE TRAILERS V2
==========================
Versión con servidor, base de datos SQLite, fotografías y enlaces compartibles.

REQUISITOS
- Node.js 18 o superior.
- Un servidor/hosting que permita Node.js si quieres publicarla en Internet.

INSTALACIÓN
1. Descomprime el ZIP.
2. Abre una terminal en la carpeta.
3. Ejecuta: npm install
4. Ejecuta: npm start
5. Abre: http://localhost:3000

DATOS
- La base de datos se crea como inventory.db.
- Las fotos se guardan en uploads/.
- Los datos permanecen aunque cierres el servidor.
- CSV y JSON están disponibles desde la pantalla principal.
- Cada inspección tiene un enlace /api/share/ID.

PUBLICACIÓN
Para que el enlace sea accesible desde cualquier celular, debes subir esta carpeta a un hosting con Node.js y usar HTTPS. La app ya está preparada para eso. Configura la variable PORT si tu proveedor la requiere.

SEGURIDAD
Para uso laboral real conviene añadir usuarios/contraseñas, permisos, copias de seguridad y almacenamiento de fotos en un servicio persistente antes de manejar información sensible.
