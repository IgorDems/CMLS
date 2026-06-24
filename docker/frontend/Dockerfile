FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN echo "Building with API URL: $VITE_API_BASE_URL"

RUN npm run build


FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist /app

ENV PORT=5001

EXPOSE 5001

CMD ["serve", "-s", ".", "-l", "5001"]
