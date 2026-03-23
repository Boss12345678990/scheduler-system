FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install -g nodemon
COPY . .
EXPOSE 5000
CMD ["nodemon", "--legacy-watch", "--watch", ".", "server.js"]
