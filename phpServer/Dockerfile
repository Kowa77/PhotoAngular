FROM php:8.4-apache

WORKDIR /var/www/html

RUN apt-get update && \
    apt-get install -y \
    apt-utils \
    libcurl4-openssl-dev \
    libzip-dev \
    git \
    unzip && \
    docker-php-ext-install curl json && \
    docker-php-ext-configure zip && \
    docker-php-ext-install zip && \
    rm -rf /var/lib/apt/lists/*

COPY . /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
