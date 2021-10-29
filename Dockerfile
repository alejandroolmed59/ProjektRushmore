# BUILD
# docker build -t rushmore:1.0 .
# RUN
# docker run --name rush p 5005:5005 --rm -d rushmore:1.0
FROM node:14.18.1

WORKDIR /opt/app

COPY package.json /opt/app

RUN npm install

COPY . /opt/app/

EXPOSE 5005

CMD ["npm", "start"]