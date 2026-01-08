# Desarrollo Local

## Setup: 3 terminales en orden

### Terminal A: Servidor local
```bash
PORT=8080 NODE_ENV=development npm run dev
```

### Terminal B: Cloudflare Tunnel
```bash
npm run tunnel
```
Espera hasta ver la URL `https://....trycloudflare.com` (se guarda automáticamente en `.tunnel-url`)

### Terminal C: Configurar webhook DEV
```bash
BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npm run webhook:dev
```

## Probar
- Envía `/start` al bot en Telegram
- Envía un documento o foto
- Los logs aparecerán en la Terminal A

## Volver a producción
```bash
BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... PROD_BASE_URL=https://your-service-xyz.a.run.app npm run webhook:prod
```

## Notas
- `.tunnel-url` está en `.gitignore`
- El webhook usa `secret_token` en dev y prod
- No se requiere `.env` si pasas las variables directamente
