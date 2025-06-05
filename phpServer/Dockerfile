FROM php:8.4-apache

WORKDIR /var/www/html

RUN apt-get update && \
    apt-get install -y \
    apt-utils \
    libcurl4-openssl-dev \
    libzip-dev \
    git \
    unzip \
    # Instalar las herramientas necesarias para pecl, si no están ya
    php-dev \
    # ¡Importante! Asegurarse de tener make y gcc para la compilación de pecl
    make \
    gcc && \
    # Instalar curl y json con el método usual
    docker-php-ext-install curl json && \
    # Ahora, instalar y habilitar la extensión zip con pecl
    pecl install zip && \
    docker-php-ext-enable zip && \
    rm -rf /var/lib/apt/lists/*

# Copia los archivos de tu aplicación PHP al directorio de trabajo del contenedor
COPY . /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
