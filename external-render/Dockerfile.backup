# Dockerfile para external-render-service
FROM node:22-alpine

WORKDIR /app

# Copiar archivos de package
COPY package*.json ./

# Instalar dependencias (usa npm install en lugar de npm ci)
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto (Railway asigna PORT automáticamente)
EXPOSE 3001

# Comando de inicio
CMD ["npm", "start"]

