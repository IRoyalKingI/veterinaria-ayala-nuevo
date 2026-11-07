# Clínica Veterinaria Ayala

Sistema web de gestión veterinaria en español. La aplicación se construye por
fases; cada fase se verifica antes de empezar la siguiente.

## Arquitectura propuesta

- **Frontend:** SPA React + TypeScript + Vite, React Router para navegación,
  Axios para la API y Tailwind CSS para estilos responsive.
- **Backend:** API REST Node.js + Express + TypeScript. La API es la única capa
  que accede a los datos clínicos.
- **Persistencia:** MySQL 8 como base de datos y Prisma ORM. No se usa
  LocalStorage para información clínica ni se sustituyen datos persistentes por
  mocks.
- **Seguridad:** autenticación JWT con secretos configurados por entorno,
  contraseñas con bcrypt, autorización por rol, validación de entradas y límites
  para cargas de archivos. No se incluirán credenciales reales en el repositorio.
- **Despliegue local:** frontend y backend se ejecutan como procesos Node
  independientes; MySQL es un servicio externo configurado mediante entorno.
  No requiere XAMPP, Apache, PHP, Firebase, SQLite ni MongoDB.

### Organización

```text
frontend/                 SPA y recursos del cliente
  src/
    app/                  Router y composición de la aplicación
    components/           Componentes compartidos
    features/             Pantallas por módulo
    lib/                  Cliente HTTP
backend/                  API REST y persistencia
  prisma/                 Esquema, migraciones MySQL y seed
  src/
    config/               Configuración validada
    middleware/           Middleware HTTP
    routes/               Rutas versionadas
```

### Fases

1. **Base del proyecto:** estructura, configuración frontend/backend,
   esquema Prisma diseñado antes de las funciones, seed configurable, ejemplos
   de entorno y API base. Verificar formato, tipos y compilación sin requerir
   acceso a un servidor MySQL.
2. **Acceso y seguridad:** inicio/cierre de sesión, JWT, bcrypt y permisos.
3. **Operación clínica:** propietarios, mascotas, consultas, vacunas y
   tratamientos, con relaciones y validaciones.
4. **Agenda:** citas, calendario y estados del flujo de atención.
5. **Administración y reportes:** dashboard, usuarios, indicadores y reportes.
6. **Archivos y cierre:** logo/fotos con validación segura, pruebas integrales,
   documentación operativa y revisión final.

No se comienza una fase nueva hasta comprobar la anterior. La verificación de
compilación o tipos no demuestra conexión real a MySQL; para afirmarlo hace
falta ejecutar la aplicación con credenciales y un servicio MySQL disponibles.

## Puesta en marcha local

Requisitos: Node.js 20 o posterior y MySQL 8. La base MySQL debe estar
iniciada y la base de datos `clinica_veterinaria_ayala` creada.

1. Copia `.env.example` a `backend/.env` y configura `DATABASE_URL`,
   `JWT_SECRET` y `SEED_ADMIN_PASSWORD`. Usa un secreto aleatorio de al menos
   32 caracteres para JWT y una contraseña inicial de 12 a 72 bytes UTF-8.
   No reutilices los valores de ejemplo.
2. Instala dependencias: `npm install`.
3. Genera el cliente: `npm run db:generate`.
4. Aplica la migración inicial a MySQL: `npm run db:migrate`.
5. Crea el administrador inicial: `npm run db:seed`.
6. En terminales separadas, inicia API y web con `npm run dev:api` y
   `npm run dev:web`.

La API escucha en `http://localhost:4000/api/v1`; su ruta de estado es
`/health`. La ruta confirma disponibilidad del proceso HTTP, no la conexión a
MySQL. La SPA usa `VITE_API_URL` y, si no se configura, intenta la API local.
No se incluyen credenciales reales ni datos clínicos de demostración.

## Modelo inicial

El esquema Prisma define usuarios y roles (`ADMIN`, `VETERINARIAN`,
`RECEPTIONIST`), propietarios, mascotas y sus consultas, vacunas, tratamientos
y citas. Los historiales tienen relaciones protegidas contra borrado en
cascada para conservar integridad. El seed crea únicamente el administrador
configurado y no inventa pacientes ni actividad clínica. Reportes y dashboard
se calcularán de los datos persistidos cuando se implementen esos módulos.

## Estado

- Arquitectura propuesta y estructura acordada: documentadas arriba.
- Fase 1: implementada y verificada; migración inicial generada, esquema Prisma
  válido, cliente generado, typecheck y compilación exitosos, auditoría sin
  vulnerabilidades y smoke test HTTP de `/health` exitoso.
- No se ejecutaron migraciones ni seed contra MySQL: no se configuró ni afirmó
  una conexión real. El smoke test usó variables efímeras y no consultó la base.
- Fase 2: autenticación y autorización por rol implementadas; typecheck, builds,
  auditoría y pruebas HTTP básicas verificados. El flujo persistente espera la
  conexión a MySQL, pero el usuario autorizó iniciar la Fase 3.
- Fase 3: módulos de propietarios, mascotas y registros clínicos implementados;
  validación Prisma, tipos, builds, auditoría, reglas de esquema y guardas HTTP
  verificados. No se afirmó persistencia real.
- Fase 4: agenda diaria implementada sobre el modelo de citas existente; build,
  typecheck y validación del esquema verificados. Sin MySQL configurado no se
  probaron operaciones persistentes.
- Fase 5: módulos de reportes y administración de usuarios implementados; usan
  los modelos existentes, sin cambios al esquema ni migraciones. La validación
  de tipos y compilación debe ejecutarse con el código disponible; las consultas
  persistentes siguen requiriendo una sesión y MySQL configurado.
- El análisis de dependencias motivó fijar Prisma/Prisma Client en `6.12.0` y
  React Router DOM en `7.18.4`; la instalación actual no reporta vulnerabilidades.


- Inicio de sesión mediante correo y contraseña; se compara el hash bcrypt y no
  se revela si falló el correo, la contraseña o el estado de la cuenta.
- JWT de corta duración firmado con HS256. La clave y la duración configurable
  se validan desde el entorno; en producción la cookie usa `Secure`.
- El token solo viaja en una cookie `HttpOnly`, `SameSite=Strict` y con alcance
  `/`. No se almacena en LocalStorage, SessionStorage ni en el estado persistente
  del navegador.
- Cada sesión JWT incluye un identificador aleatorio registrado en la tabla
  MySQL `AuthSession`. El cierre revoca ese identificador en la base y borra la
  cookie; también se comprueba en cada petición autenticada que la sesión siga
  vigente y que el usuario activo conserve su rol actual.
- Las mutaciones de autenticación y de datos clínicos exigen el origen web
  exacto configurado (no aceptan solicitudes de origen ausente); CORS acepta
  únicamente ese origen y usa credenciales. Los endpoints de sesión envían
  `Cache-Control: no-store`.
  Los intentos de inicio de sesión se limitan a
  10 por ventana de 15 minutos y dirección que la API observa. El limitador vive
  en memoria: producción con varias instancias requiere un almacén compartido y
  configuración explícita del proxy de confianza.
- `authorizeRoles(...)` es el middleware de autorización para rutas privadas.
  Las acciones por módulo deberán declararlo explícitamente al implementar cada
  endpoint; ocultar controles en la interfaz no sustituye esa verificación.
- El seed crea el primer administrador de forma explícita y no cambia una cuenta
  existente. Las contraseñas iniciales aceptadas son de 12 a 72 bytes UTF-8.
- La migración de esta fase agrega `AuthSession`. Aplicarla requiere MySQL 8 y
  `DATABASE_URL` válido. La API no debe exponerse en producción sin HTTPS, un
  secreto generado fuera del repositorio y una política adecuada de copias y
  acceso a la base de datos.
- Las pruebas HTTP de la fase validan que una solicitud sin sesión recibe 401,
  origen incorrecto o ausente recibe 403, CORS anuncia credenciales, los
  primeros diez intentos inválidos reciben 400 y el siguiente recibe 429, y el
  cierre con cookie inválida es idempotente. El guard de roles también rechazó
  recepción (403), permitió administración (204) y rechazó peticiones sin
  usuario (401). El formulario se revisó en navegador; no fue posible verificar
  credenciales, cookie JWT válida, persistencia o revocación contra MySQL sin un
  servicio y credenciales.
- Sigue pendiente probar inicio de sesión válido, persistencia de cookie y
  revocación contra MySQL real; no se simuló una base de datos.

## Tema visual

La pantalla de acceso y el espacio de trabajo permiten alternar entre tema
diurno y nocturno. La selección se guarda únicamente como preferencia visual
(`ayala-theme`) y los colores semánticos adaptan texto, superficies, bordes y
estados para mantener el contraste. El tema inicial respeta la preferencia de
color del sistema cuando la persona todavía no ha elegido uno. Ningún dato
clínico se guarda en almacenamiento del navegador.

## Operación clínica (Fase 3)

La API incorpora endpoints protegidos y paginados para propietarios, mascotas,
consultas, vacunas y tratamientos (`/api/v1/owners`, `/api/v1/pets` y
`/api/v1/clinical/*`). El cliente puede consultar y buscar los expedientes, crear
registros y editar datos demográficos de propietarios y pacientes. El historial
clínico es de solo anexado para conservar trazabilidad; no se borran ni
sobrescriben consultas, vacunas o tratamientos desde estos endpoints.

Administración y personal veterinario pueden acceder al historial clínico. El
personal de recepción puede gestionar contactos e identificación de pacientes,
pero no consultar ni modificar notas clínicas, tratamientos o vacunación. La
API aplica los permisos además de ocultar la navegación correspondiente en la
interfaz.

Los formularios verifican datos y muestran errores; los endpoints usan Prisma
contra MySQL y no ofrecen modo de demostración. Las pantallas muestran registros
reales o un estado vacío; nunca se rellenan con expedientes ficticios. En esta
sesión no se configuró MySQL: aplicar el esquema inicial y la migración de
sesiones, ejecutar el seed y validar operaciones CRUD con datos reales requiere
un servicio MySQL 8 accesible. Las fases 2 y 3 comparten esa limitación; la
Fase 4 tampoco se ha probado con operaciones persistentes.

## Agenda (Fase 4)

La ruta `/appointments` permite consultar las citas que se solapan con el día
seleccionado, registrar citas para un propietario y mascota opcional, y cambiar
su estado a confirmada, completada, cancelada o no asistió. La API expone
`GET` y `POST /api/v1/appointments` y `PATCH
/api/v1/appointments/:id/status`; exige sesión, origen confiable en mutaciones y
validación de horario y pertenencia de la mascota al propietario. Las citas
completadas, canceladas o marcadas como inasistencia no se pueden reabrir.

No se añadió migración: el modelo `Appointment` ya estaba en el esquema inicial.
El listado, la creación y los cambios de estado requieren MySQL disponible y
sesión válida; no se ejecutaron contra una base de datos en esta verificación.

## Administración y reportes (Fase 5)

El módulo `/reports` presenta los totales actuales de propietarios y mascotas,
y el número de citas, consultas, vacunas y tratamientos iniciados dentro del
periodo elegido. También muestra las citas por estado. Los reportes están
disponibles para los tres roles; la API devuelve agregados y no expone
expedientes clínicos individuales en este módulo.

La API obtiene el resumen desde `GET /api/v1/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`.
El rango admite hasta 366 días. El conteo de citas usa la fecha de inicio; las
consultas, la fecha de consulta; las vacunas, la fecha de aplicación; y los
tratamientos, la fecha de inicio.

El módulo `/users` está disponible para administración y personal veterinario.
Permite listar y buscar usuarios, crear cuentas con contraseña asignada,
actualizar sus datos, roles y estado, y restablecer contraseñas. Las contraseñas
se guardan con bcrypt; al restablecer una se revocan las sesiones de esa cuenta.
Las cuentas se desactivan en lugar de borrarse, no se puede modificar el propio
rol ni desactivar la propia cuenta, y la API impide retirar el acceso de la
última cuenta administradora activa. Las rutas aplican los permisos en servidor.

Estos módulos usan los modelos existentes y no requieren una migración. Sus
consultas y cambios de usuarios necesitan MySQL y una sesión válida; no se
ejecutaron contra la base de datos durante esta implementación.

## Reportes por turno y documentos

El reporte existente admite resumen general, consultas, vacunación, citas,
distribución por especie y actividad por turno. Las fechas filtran la fecha de
consulta, aplicación, inicio del tratamiento o inicio de cita, según el
registro. Los totales de mascotas, propietarios y especies son históricos y se
identifican como tales. La distribución incluye las especies registradas y
calcula sus porcentajes sobre el padrón completo. El botón de impresión usa los
resultados visibles y oculta los controles y la navegación.

Las consultas, vacunas, tratamientos y citas tienen ahora un campo de turno
opcional (`MORNING` o `AFTERNOON`). Se captura manualmente, sin derivarlo de la
hora; los registros históricos permanecen sin turno y aparecen como
“No especificado”. La migración no destructiva está en
`backend/prisma/migrations/20261026180000_add_work_shifts`. Debe revisarse y
aplicarse en el entorno apropiado con `npm run db:migrate` desde `backend`
(desarrollo) o `npx prisma migrate deploy` (despliegue). No se ejecutó en esta
implementación; mientras no se aplique, las nuevas consultas Prisma que usan
esas columnas no estarán disponibles contra MySQL.

El catálogo de `/documents` muestra únicamente la Receta veterinaria (formato
oficial) y la Autorización de eutanasia. Otros formatos aún no habilitados se
mantienen fuera del catálogo; sus plantillas y datos históricos no se eliminan.

El recetario oficial está disponible en
`Documentos/Plantillas/RECETARIO NUEVO 2026.docx`. Desde `/consultations` o
`/documents`, una persona administradora o veterinaria puede seleccionar una
consulta, revisar los datos relacionados y editar una receta sin modificar la
consulta clínica. La vista previa se genera a partir del DOCX original y
conserva su logotipo, tablas y tamaño carta. Desde ella se puede guardar la
receta relacionada con la consulta o imprimirla; para generar un PDF, usa
“Guardar como PDF” en el diálogo de impresión del navegador.

Las recetas guardadas se relacionan de forma única con su consulta, mascota,
propietario y usuario elaborador. La migración no destructiva está en
`backend/prisma/migrations/20261105160000_add_prescriptions`; aplícala en el
entorno correspondiente con `npx prisma migrate deploy` desde `backend`.

En `/documents` también está disponible la Autorización de Eutanasia, basada en
`Documentos/Plantillas/Autorizacion_Eutanasia_Ayala.docx`. Completa los datos
registrados del paciente y propietario; diagnóstico, pronóstico, alternativas
y demás datos no registrados deben capturarse manualmente. La vista previa se
genera en un modal aislado que comparte el visor del recetario. La impresión
conserva la plantilla y permite elegir “Guardar como PDF” en el diálogo del
navegador. Al imprimir o descargar se registra el documento, la mascota, el
propietario y el usuario que lo generó; este registro no representa que se
haya realizado un procedimiento ni marca casillas de autorización o firma.
La migración `backend/prisma/migrations/20261105190000_add_euthanasia_authorizations`
crea ese historial independiente y se aplica con `npx prisma migrate deploy`
desde `backend`.

El logo se sirve desde `frontend/public/images/logo-clinica-ayala.png`, que es
el recurso disponible en el proyecto; no se encontró el archivo con nombre
`logo-clinica-ayala.jpg`.
