# ============================================================
# Frontend — Dockerfile (Producción)
# Stage 1: Build de la aplicación con Node.js
# Stage 2: Servir con Nginx (Alpine) optimizado para SPA
# ============================================================

# ── Etapa de Build ──────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package.json package-lock.json* ./
RUN npm install

# Copiar el código y construir
COPY . .
RUN npm run build

# ── Etapa de Producción ─────────────────────────────────────
FROM nginx:alpine

# Limpiar carpeta de html por defecto
RUN rm -rf /usr/share/nginx/html/*

# Copiar build desde el stage anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración custom de nginx para React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
