FROM node:7
MAINTAINER Jeff Dickey <dickeyxxx@gmail.com>

RUN apt-get -y update && \
  apt-get install -y --no-install-recommends \
  ocaml libelf-dev \
  python-pip python-dev build-essential \
  p7zip-full \
  && apt-get clean && \
  rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip && \
      pip install --upgrade virtualenv && \
      pip install --upgrade awscli

CMD bash
