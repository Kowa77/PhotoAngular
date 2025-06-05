FROM php:7.4-apache

# Establece el directorio de trabajo en el contenedor
WORKDIR /var/www/html

# Instalar las dependencias del sistema necesarias
# Incluimos 'libicu-dev' para la extensión 'intl' que sugiere la guía,
# y 'libzip-dev' junto con 'zlib1g-dev' para la extensión 'zip'.
# 'make' y 'gcc' son esenciales para compilar extensiones.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libicu-dev \
    libzip-dev \
    zlib1g-dev \
    git \
    unzip \
    make \
    gcc && \
    # Limpiamos las cachés de apt para reducir el tamaño final de la imagen
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

# Instalar y habilitar las extensiones PHP
# Usamos 'docker-php-ext-install' para 'intl' y 'curl'.
# Para 'zip', seguimos el proceso manual de compilación probado para evitar errores.
RUN docker-php-ext-install intl curl json && \
    # Extraemos el código fuente de PHP, necesario para compilar extensiones PECL
    docker-php-source extract && \
    # Compilamos e instalamos la extensión 'zip' manualmente
    (cd /usr/src/php/ext/zip && \
    phpize && \
    ./configure && \
    make && \
    make install) && \
    # Habilitamos la extensión 'zip' en la configuración de PHP
    docker-php-ext-enable zip && \
    # Limpiamos el código fuente de PHP para mantener la imagen pequeña
    docker-php-source delete && \
    # Habilitamos el módulo de reescritura de Apache, como sugiere la guía
    a2enmod rewrite

# Copia los archivos de tu aplicación en el contenedor
# Asegúrate de que los archivos de tu aplicación estén en el mismo directorio que este Dockerfile.
COPY . /var/www/html

# Exponer el puerto 80, que es el predeterminado para los servidores Apache
EXPOSE 80

# Define el comando que se ejecutará cuando se inicie el contenedor
# Esto inicia Apache en primer plano.
CMD ["apache2-foreground"]
