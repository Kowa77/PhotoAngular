FROM php:8.1-apache

WORKDIR /var/www/html

# Instala apt-utils primero para evitar errores de debconf, y luego el resto de dependencias.
RUN apt-get update && \
    apt-get install -y \
    apt-utils \
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
# Asegúrate de que los archivos dentro de phpServer/ se copien a /var/www/html
COPY . /var/www/html

# Si tu directorio 'vendor' ya está en Git, no necesitas descomentar la línea de composer install.
# Si 'vendor' no está en Git y quieres que Composer lo genere en Back4App,
# entonces descomenta las siguientes líneas:
# COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
# RUN composer install --no-dev --optimize-autoloader

EXPOSE 80

CMD ["apache2-foreground"]
