# API con registro de un clic

Proyecto: https://script.google.com/home/projects/1ZzPYBzGfoO0eDhhxGEieSHddUyhQI6C55rtI_S5cibQDmyv2N9kHCLjV/edit

Reemplazar Codigo.gs por Codigo.js. Guardar y editar la implementacion web
existente en Implementar > Administrar implementaciones > Nueva version.
Conservar la URL actual. El endpoint acepta action registrar_revision con
nombre, correo y requestId unico por clic. Reintentar con el mismo requestId.

El servidor agrega una fila COMPLETADO por registro y programa el siguiente
aviso desde la hora guardada + frecuenciaMin. La configuracion se lee de la
misma planilla que contiene Registro Detallado.

Actualizar a extension 1.3.0 y reiniciar Windows app. No usar el cliente viejo
de dos pasos. Los archivos xlsx son copias independientes del registro online.
