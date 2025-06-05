FROM php:8.3-apache

WORKDIR /var/www/html

# Stage 1: Install system dependencies
# We add necessary build tools and libraries for PHP extensions.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-utils \
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
# This includes common extensions and the manually compiled zip extension.
RUN docker-php-ext-install curl json && \
    # Extract PHP source, required to build PECL extensions like zip
    docker-php-source extract && \
    # Manually build and install the zip extension
    # This bypasses potential issues with 'pecl install' in certain environments.
    (cd /usr/src/php/ext/zip && \
    phpize && \
    ./configure && \
    make && \
    make install) && \
    # Enable the zip extension in PHP's configuration
    docker-php-ext-enable zip && \
    # Clean up PHP source files to keep the final image size minimal
    docker-php-source delete

# Copy your application files into the container
# Ensure your application code is in the same directory as this Dockerfile.
COPY . /var/www/html

# Expose port 80, the default for Apache web servers
EXPOSE 80

# Define the command to run when the container starts
# This starts Apache in the foreground.
CMD ["apache2-foreground"]
