# Coleccion Tracker

Aplicacion web estatica para gestionar tu coleccion de videojuegos, figuras y otros objetos, con inventario editable, registro de compras y ventas, y balance de costes.

## Funciones incluidas

- Alta, edicion y eliminacion de objetos de la coleccion.
- Filtros para visualizar el inventario por texto, categoria y estado.
- Registro de compras y ventas seleccionando objetos del inventario.
- Balance global, coste neto de la coleccion activa y valor estimado.
- Persistencia local en el navegador.
- Sincronizacion opcional con Google Drive mediante un fichero JSON en la carpeta PROGRAMA_WEB_GASTOS.

## Google Drive

La app esta preparada para trabajar con esta carpeta de tu Drive:

- Nombre: PROGRAMA_WEB_GASTOS
- Folder ID: 15Lah8e-U9CsUR_O-KUajU8W5OGn0vvPS
- Fichero JSON esperado: coleccion_tracker_db.json

Necesitas crear un OAuth Client ID de tipo Web Application en Google Cloud y pegarlo en la propia app.

Orgenes recomendados:

- Local: http://localhost:5500
- GitHub Pages del repositorio actual: https://swimpiii.github.io

Scope configurado:

- https://www.googleapis.com/auth/drive

Se usa este scope amplio porque la app debe poder acceder a una carpeta concreta ya existente de tu Drive y crear el JSON dentro de ella.

## Ejecutar en local

Desde esta carpeta:

```powershell
python -m http.server 5500
```

Y luego abre:

```text
http://localhost:5500/
```

## Publicar en la misma cuenta de GitHub que PROGRAMA_ESTUDIO_AJEDREZ

El remoto del workspace apunta a la cuenta SwimPiii y al repositorio PROGRAMA_GORDERIA_EXTREMA.

Ruta prevista para publicar esta app dentro del mismo repo:

- PROGRAMA_WEB_COLECCION/

Si GitHub Pages sirve la rama o carpeta adecuada, la URL final sera del estilo:

```text
https://swimpiii.github.io/PROGRAMA_GORDERIA_EXTREMA/PROGRAMA_WEB_COLECCION/
```

Como la app usa rutas relativas, no necesita cambios extra para funcionar dentro de esa subcarpeta.