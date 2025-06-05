FROM php:8.3-apache
# Stick to 8.3 for now, or 8.2 if you prefer

WORKDIR /var/www/html

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-utils \
    libcurl4-openssl-dev \
    libzip-dev \
    git \
    unzip \
    # We still need make and gcc for compilation
    make \
    gcc && \
    # Clean up apt caches (moved here to reduce image size before source download)
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

# Install and enable PHP extensions
RUN docker-php-ext-install curl json && \
    # Use docker-php-source to prepare for PECL
    docker-php-source extract && \
    # Install and enable the zip extension via pecl
    pecl install zip && \
    docker-php-ext-enable zip && \
    # Clean up PHP source files after compilation
    docker-php-source delete

# Copy your application files to the container's working directory
COPY . /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
