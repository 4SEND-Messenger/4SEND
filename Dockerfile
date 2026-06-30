FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev && npm install -g pm2

COPY . .

RUN mkdir -p uploads

ENV PORT=7860
ENV NODE_ENV=production

EXPOSE 7860

CMD ["pm2-runtime", "start", "server.js", "-i", "1"]