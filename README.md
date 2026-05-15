# Coleccion Tracker

Aplicacion web estatica para registrar compras, consultar inventario, marcar objetos en venta y cerrar ventas de tu coleccion.

## Estado actual

- Repositorio GitHub: https://github.com/SwimPiii/COLECCION_ISMAEL
- Fichero de datos en Drive: coleccion_tracker_db.json
- Carpeta de Drive: COLECCION_ISMAEL
- Folder ID: 1hyYuZ9bg8AoWwGtwfL9xgQtkgUlhMHiE
- Cuenta objetivo: ismaelfernandezsaez2@gmail.com

## Google Drive

La app ya lleva configurado el mismo OAuth Client ID que GORDERIA_EXTREMA.

Necesitas que en Google Cloud ese Client ID tenga autorizados estos origins:

- http://localhost:5511
- https://swimpiii.github.io

La app usa este scope:

- https://www.googleapis.com/auth/drive

Se usa ese scope porque el JSON vive dentro de una carpeta concreta ya existente de tu Drive.

## Ejecutar en local

Desde esta carpeta:

```powershell
python -m http.server 5511
```

Y luego abre:

```text
http://127.0.0.1:5511/index.html
```

## Publicacion

El repo ya incluye workflow de GitHub Pages.

Cuando Pages este activado con GitHub Actions, la URL publica sera:

```text
https://swimpiii.github.io/COLECCION_ISMAEL/
```