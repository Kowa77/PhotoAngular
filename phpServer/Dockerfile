FROM php:8.3-apache
# Keep using 8.3 or 8.2 for stability

WORKDIR /var/www/html

# Stage 1: Install system dependencies and build extensions
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-utils \
    libcurl4-openssl-dev \
    libzip-dev \
    # Explicitly add zlib1g-dev, which is a common dependency for zip extension compilation
    zlib1g-dev \
    git \
    unzip \
    make \
    gcc && \
    # Clean up apt caches immediately after installation
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

# Stage 2: Install and enable PHP extensions
# We put this in a separate RUN to ensure previous dependencies are solid.
# This also allows Docker to cache the system dependencies layer.
RUN docker-php-ext-install curl json && \
    # Extract PHP source to compile PECL extensions
    docker-php-source extract && \
    # Install the zip extension using pecl
    pecl install zip && \
    # Enable the zip extension
    docker-php-ext-enable zip && \
    # Clean up PHP source after compilation to reduce image size
    docker-php-source delete

# Copy your application files to the container's working directory
COPY . /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
