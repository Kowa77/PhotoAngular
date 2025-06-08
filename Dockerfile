# Usa una imagen base oficial de PHP-FPM para Alpine Linux.
# Alpine es ligera y eficiente. Asegúrate de que la versión de PHP (ej. 8.2) sea compatible con tu código.
# Puedes ajustar '8.2' a la versión de PHP que estés usando si es diferente.
FROM php:8.2-fpm-alpine

# Instala Nginx y algunas utilidades básicas.
# Nginx será el servidor web que servirá tu aplicación y manejará CORS.
RUN apk add --no-cache nginx

# Elimina la configuración por defecto de Nginx para reemplazarla con la nuestra.
# Esto asegura que nuestro archivo default.conf sea el único activo.
RUN rm /etc/nginx/conf.d/default.conf

# Copia tu configuración de Nginx personalizada.
# Este archivo (docker/nginx.conf) es crucial para las cabeceras CORS.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copia tu código PHP al directorio de Nginx.
# La ruta '/var/www/html' es un directorio común para servir contenido web dentro de los contenedores.
# Asegúrate de que tu carpeta 'phpServer' está en la raíz de tu repositorio.
COPY ./phpServer /var/www/html

# Establece los permisos correctos para el directorio de la aplicación.
# 'www-data' es el usuario que suele usar Nginx/PHP-FPM dentro de los contenedores.
RUN chown -R www-data:www-data /var/www/html && \
    chmod -R 755 /var/www/html

# Expone el puerto 8000.
# Este es el puerto en el que Nginx escuchará DENTRO del contenedor Docker.
# En la configuración de Koyeb, también deberás configurar el puerto 8000.
EXPOSE 8000

# Comando para iniciar Nginx y PHP-FPM.
# 'nginx -g 'daemon off;'' inicia Nginx en primer plano (necesario para Docker).
# 'php-fpm' inicia el procesador de PHP.
CMD ["sh", "-c", "nginx -g 'daemon off;' && php-fpm"]
