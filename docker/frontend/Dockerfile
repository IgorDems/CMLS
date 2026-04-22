# Етап 1: Збірка (Build)
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Етап 2: Сервірування (Production)
FROM node:16-alpine
WORKDIR /app
RUN npm install -g serve
# Копіюємо тільки результат збірки (папку dist або build)
COPY --from=build /app/dist /app
ENV PORT=5001
ENV NODE_ENV=production
EXPOSE 5001
CMD ["serve", "-s", ".", "-l", "5001"]
