# Sample Dockerfile for NestJS API
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE ${Port}

CMD ["npm", "run", "start:prod"]