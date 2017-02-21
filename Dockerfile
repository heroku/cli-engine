FROM node:7
MAINTAINER Jeff Dickey <dickeyxxx@gmail.com>

ADD https://dl.yarnpkg.com/debian/pubkey.gpg /tmp/yarn-pubkey.gpg
RUN apt-key add /tmp/yarn-pubkey.gpg && rm /tmp/yarn-pubkey.gpg
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list

RUN apt-get -y update && \
  apt-get install -y --no-install-recommends \
  yarn \
  ocaml \
  libelf-dev \
  && apt-get clean && \
  rm -rf /var/lib/apt/lists/*

