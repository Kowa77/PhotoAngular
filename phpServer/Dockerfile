FROM php:8.3-apache

WORKDIR /var/www/html

# Install system dependencies and PHP extensions
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-utils \
    libcurl4-openssl-dev \
    libzip-dev \
    git \
    unzip \
    # Now php8.3-dev (or php8.2-dev) and php-pear should be available
    php8.3-dev \ # or php8.2-dev if using php:8.2-apache
    php-pear \
    make \
    gcc && \
    # Install curl and json PHP extensions directly
    docker-php-ext-install curl json && \
    # Install and enable the zip extension via pecl
    pecl install zip && \
    docker-php-ext-enable zip && \
    # Clean up apt caches to reduce image size
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

# Copy your application files to the container's working directory
COPY . /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
