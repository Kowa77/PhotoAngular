FROM php:8.3-apache

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /var/www/html

# --- Fase 1: Instalación de dependencias del sistema y herramientas de compilación ---
# Actualiza los repositorios e instala paquetes necesarios para la compilación
# y las extensiones de PHP.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-utils \
    pkg-config \
    libicu-dev \
    libcurl4-openssl-dev \
    libzip-dev \
    zlib1g-dev \
    git \
    unzip \
    make \
    gcc && \
    # Limpia las cachés de apt para reducir el tamaño final de la imagen
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

# --- Fase 2: Instalación de extensiones PHP y Composer ---
# Instala extensiones PHP comunes (intl, curl, json) utilizando docker-php-ext-install.
# Para 'zip', se utiliza docker-php-ext-configure y docker-php-ext-install,
# que es el método preferido para estas imágenes.
RUN docker-php-ext-install intl curl json && \
    # Extrae el código fuente de PHP, indispensable para compilar extensiones PECL.
    # Aunque docker-php-ext-install puede hacer esto internamente para algunas,
    # es buena práctica mantenerlo explícito si se usan comandos pecl directos o para debugging.
    docker-php-source extract && \
    # Configura y luego instala la extensión 'zip' usando las herramientas de Docker PHP.
    # Esto es más robusto que la compilación manual para la mayoría de los casos.
    docker-php-ext-configure zip && \
    docker-php-ext-install zip && \
    # Habilita la extensión 'zip' en la configuración de PHP
    docker-php-ext-enable zip && \
    # Limpia el código fuente de PHP después de la compilación para mantener la imagen ligera
    docker-php-source delete && \
    # Habilita el módulo 'rewrite' de Apache para URLs amigables
    a2enmod rewrite

# --- Fase 3: Copiar la aplicación y sus dependencias ---
# Copia la imagen de Composer y luego instala las dependencias de tu proyecto.
# Asume que tu archivo composer.json está en la raíz de tu proyecto.
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
# Copia todos los archivos de tu aplicación al directorio de trabajo del contenedor
COPY . /var/www/html
# Instala las dependencias de Composer definidas en tu composer.json
# --no-dev y --optimize-autoloader son buenas prácticas para producción
RUN composer install --no-dev --optimize-autoloader

# --- Fase 4: Configuración de permisos ---
# Cambia la propiedad de los archivos de la aplicación al usuario de Apache (www-data)
RUN chown -R www-data:www-data /var/www/html

# --- Fase 5: Configuración de red y punto de entrada ---
# Expone el puerto 80, que es el puerto HTTP estándar para Apache
EXPOSE 80
# Define el comando que se ejecutará al iniciar el contenedor, arrancando Apache en primer plano
CMD ["apache2-foreground"]
