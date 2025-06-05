FROM php:8.4-apache # ¡CAMBIO AQUÍ!

WORKDIR /var/www/html

RUN apt-get update && \
    apt-get install -y \
    apt-utils \
    libcurl4-openssl-dev \
    libzip-dev \
    git \
    unzip && \
    # Instala las extensiones PHP. Separamos 'zip' por si acaso.
    docker-php-ext-install curl json && \
    docker-php-ext-configure zip && \
    docker-php-ext-install zip && \
    rm -rf /var/lib/apt/lists/*

# Copia los archivos de tu aplicación PHP al directorio de trabajo del contenedor
COPY . /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
