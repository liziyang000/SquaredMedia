FROM php:8.4-apache

COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-squaredmedia.ini

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
    libzip-dev \
    unzip \
  && docker-php-ext-configure gd --with-freetype --with-jpeg \
  && docker-php-ext-install -j"$(nproc)" gd mysqli pdo_mysql zip opcache \
  && a2enmod rewrite headers \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html
