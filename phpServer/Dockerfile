# Usa una imagen base de PHP con Apache
FROM php:8.1-apache

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /var/www/html

# Instala extensiones PHP necesarias si las tienes (ej. curl para API requests)
# Esto es un ejemplo, podrías necesitar otras.
# Para Mercado Pago, 'curl' y 'json' suelen ser útiles.
RUN apt-get update && \
    apt-get install -y \
    libcurl4-openssl-dev \
    libzip-dev \
    git \
    unzip && \
    docker-php-ext-install \
    curl \
    json \
    zip \
    && rm -rf /var/lib/apt/lists/*

# Copia los archivos de tu aplicación PHP al directorio de trabajo del contenedor
COPY . /var/www/html

# Si usas Composer (y ya tienes un composer.json/composer.lock para Mercado Pago SDK),
# asegúrate de instalar las dependencias:
# COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
# RUN composer install --no-dev --optimize-autoloader

# Habilita el módulo de reescritura de Apache si lo necesitas (para URLs amigables)
# Tu `index.php` probablemente no lo necesite si toda la lógica está en un solo archivo.
# RUN a2enmod rewrite

# Si tu .htaccess o alguna configuración especial de Apache no está en la raíz,
# o si quieres una configuración personalizada, podrías copiar un archivo de config.conf:
# COPY apache/config.conf /etc/apache2/sites-available/000-default.conf

# Expone el puerto 80 (el puerto por defecto de Apache)
EXPOSE 80

# Comando para que Apache se ejecute cuando el contenedor se inicie
CMD ["apache2-foreground"]
