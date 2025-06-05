FROM php:8.3-apache

WORKDIR /var/www/html

# Stage 1: Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-utils \
    libcurl4-openssl-dev \
    libzip-dev \
    # Still needed for zip compilation
    zlib1g-dev \
    git \
    unzip \
    make \
    gcc && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

# Stage 2: Install and enable PHP extensions
RUN docker-php-ext-install curl json && \
    # Extract PHP source (for pecl to compile against)
    docker-php-source extract && \
    # Build and install the zip extension manually
    # Navigate to the zip extension source directory
    (cd /usr/src/php/ext/zip && \
    # Run phpize to prepare the build environment
    phpize && \
    # Configure the extension for compilation
    ./configure && \
    # Compile the extension
    make && \
    # Install the compiled extension
    make install) && \
    # Enable the zip extension in PHP
    docker-php-ext-enable zip && \
    # Clean up PHP source after compilation
    docker-php-source delete

# Copy your application files to the container's working directory
COPY . /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
