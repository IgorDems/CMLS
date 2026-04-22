FROM node:18

# Робоча директорія всередині контейнера
WORKDIR /usr/src/app

# Копіюємо файли залежностей (вони будуть взяті з source/backend)
COPY package*.json ./

RUN npm install

# Копіюємо весь інший код
COPY . .

EXPOSE 5000

CMD ["npm", "start"]
