FROM php:7.4-apache

WORKDIR /var/www/html

# Stage 1: Install system dependencies
# Removed the conflicting libcurl4-gnutls-dev.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-utils \
    pkg-config \
    libicu-dev \
    # ONLY install libcurl4-openssl-dev (removed gnutls to avoid conflict)
    libcurl4-openssl-dev \
    libzip-dev \
    zlib1g-dev \
    git \
    unzip \
    make \
    gcc && \
    # Clean up apt caches
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

# Stage 2: Install and enable PHP extensions
RUN docker-php-ext-install intl curl json && \
    docker-php-source extract && \
    (cd /usr/src/php/ext/zip && \
    phpize && \
    ./configure && \
    make && \
    make install) && \
    docker-php-ext-enable zip && \
    docker-php-source delete && \
    a2enmod rewrite

# Copy your application files
COPY . /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
