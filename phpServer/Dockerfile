# Usa la imagen oficial de PHP con Apache, versión 8.3, ya que es compatible con Composer
FROM php:8.3-apache

# Establece el directorio de trabajo predeterminado dentro del contenedor
# Aquí es donde se copiarán los archivos de tu aplicación y se ejecutarán los comandos.
WORKDIR /var/www/html

# --- Fase 1: Instalación de dependencias del sistema y herramientas de compilación ---
# Actualiza el índice de paquetes y luego instala las dependencias del sistema.
# Se incluyen herramientas de compilación (make, gcc), librerías de desarrollo (libicu-dev, libzip-dev, zlib1g-dev, libcurl4-openssl-dev, libonig-dev)
# y utilidades como git, unzip, y pkg-config, esenciales para compilar extensiones PHP y otras operaciones.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-utils \
    pkg-config \
    libicu-dev \
    libcurl4-openssl-dev \
    libzip-dev \
    zlib1g-dev \
    libonig-dev \
    git \
    unzip \
    make \
    gcc && \
    # Limpia las cachés de APT para reducir el tamaño final de la imagen.
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

# --- Fase 2: Instalación de extensiones PHP y Composer globalmente ---
# Instala las extensiones PHP esenciales (mbstring, intl, curl, json)
# utilizando la herramienta oficial 'docker-php-ext-install'.
RUN docker-php-ext-install mbstring intl curl json && \
    # Extrae el código fuente de PHP. Esto es crucial para que PECL (o la compilación manual)
    # pueda construir extensiones contra la versión exacta de PHP en el contenedor.
    docker-php-source extract && \
    # Compila e instala la extensión 'zip' manualmente. Este método ha demostrado ser el más robusto
    # para tu entorno, evitando problemas como 'cannot stat modules/*'.
    (cd /usr/src/php/ext/zip && \
    phpize && \
    ./configure && \
    make && \
    make install) && \
    # Habilita la extensión 'zip' en la configuración de PHP.
    docker-php-ext-enable zip && \
    # Limpia el código fuente de PHP después de la compilación para mantener la imagen ligera.
    docker-php-source delete && \
    # Habilita el módulo 'rewrite' de Apache para URLs amigables (común en apps PHP puras con rutas bonitas).
    a2enmod rewrite && \
    # Instala Composer de forma global en el contenedor para que esté disponible en cualquier parte.
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" && \
    php composer-setup.php --install-dir=/usr/local/bin --filename=composer && \
    php -r "unlink('composer-setup.php');"

# --- Fase 3: Copia la aplicación PHP y sus dependencias ---
# Copia todos los archivos de tu aplicación PHP puro desde el contexto de construcción (tu directorio local)
# al directorio de trabajo dentro del contenedor.
COPY . /var/www/html
# Si tu aplicación de PHP puro usa Composer, instala sus dependencias.
RUN composer install --no-dev --optimize-autoloader --prefer-dist

# --- Fase 4: Configuración de permisos de archivos ---
# Ajusta los permisos de los archivos para que el servidor web Apache (usuario www-data) pueda leer y escribir.
RUN chown -R www-data:www-data /var/www/html

# --- Fase 5: Ajustes de Apache y punto de entrada ---
# Copia tu archivo de configuración de Apache personalizado.
# DEBES crear este archivo 'apache-config.conf' en la raíz de tu proyecto.
COPY apache-config.conf /etc/apache2/sites-available/000-default.conf

# Expone el puerto 80 del contenedor, permitiendo que el tráfico HTTP llegue a tu aplicación.
EXPOSE 80

# Define el comando predeterminado que se ejecutará cuando el contenedor se inicie.
# 'apache2-foreground' inicia Apache en primer plano, lo que es necesario para Docker.
CMD ["apache2-foreground"]
