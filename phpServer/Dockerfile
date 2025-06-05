FROM php:8.4-apache

WORKDIR /var/www/html

# Install system dependencies and PHP extensions
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-utils \
    libcurl4-openssl-dev \
    libzip-dev \
    git \
    unzip \
    php-dev \
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
