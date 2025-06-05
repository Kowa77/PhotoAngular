FROM php:8.3-apache

WORKDIR /var/www/html

# Stage 1: Install system dependencies
# These are necessary build tools and libraries for PHP extensions.
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
    # Clean up apt caches to reduce image size
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

# Stage 2: Install and enable PHP extensions
# This includes common extensions (intl, curl, json) and the manually compiled zip extension.
# Note: For PHP 8.x, docker-php-ext-install curl usually works without pkg-config issues,
# but leaving pkg-config and libcurl4-openssl-dev won't hurt.
RUN docker-php-ext-install intl curl json && \
    # Extract PHP source, required to build PECL extensions like zip
    docker-php-source extract && \
    # Manually build and install the zip extension
    # This bypasses potential issues with 'pecl install' in certain environments.
    (cd /usr/src/php/ext/zip && \
    phpize && \
    ./configure && \
    make && \
    make install) && \
    # Enable the zip extension in PHP
    docker-php-ext-enable zip && \
    # Clean up PHP source files to keep the final image size minimal
    docker-php-source delete && \
    # Enable Apache's rewrite module
    a2enmod rewrite

# Copy your application files into the container
# Ensure your application code is in the same directory as this Dockerfile.
COPY . /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
