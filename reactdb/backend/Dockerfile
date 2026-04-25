# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY --from=builder /app/dist ./dist

# Create complains directory with proper permissions before app starts
RUN mkdir -p /app/complains && \
    chmod 755 /app/complains && \
    chmod 755 /app

RUN mkdir -p /app/dailystatus && \
    chmod 755 /app/dailystatus && \
    chmod 755 /app

RUN mkdir -p /app/tenantphotos && \
    chmod 755 /app/tenantphotos && \
    chmod 755 /app

RUN mkdir -p /app/paymentreceipts && \
    chmod 755 /app/paymentreceipts && \
    chmod 755 /app

    RUN mkdir -p /app/banner && \
    chmod 755 /app/banner && \
    chmod 755 /app

# Set environment variable for complains directory
ENV COMPLAINS_DIR=/app/complains
ENV DAILY_STATUS_DIR=/app/dailystatus
ENV TENANT_PHOTOS_DIR=/app/tenantphotos
ENV PAYMENT_RECEIPTS_DIR=/app/paymentreceipts
ENV BANNER_DIR=/app/banner

EXPOSE 5000

CMD ["npm", "start"]
