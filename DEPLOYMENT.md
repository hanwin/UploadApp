# Deployment Guide – Audio Upload App

Hur du installerar appen på en ny server med nginx reverse proxy och Let's Encrypt SSL.

## Förutsättningar

- Ubuntu 22.04+ (eller liknande)
- Docker Engine 20.10+ och Docker Compose v2+
- Nginx installerad
- Ett domännamn som pekar mot servern (DNS A-record)

## 1. Installera Docker (om det saknas)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logga ut och in igen
```

## 2. Klona och konfigurera

```bash
cd /opt
sudo mkdir audio-upload && sudo chown $USER:$USER audio-upload
git clone <repo-url> audio-upload
cd audio-upload

cp .env.example .env
nano .env
```

Fyll i alla variabler i `.env`:

```bash
DB_PASSWORD=<starkt-lösenord>
JWT_SECRET=<generera med: openssl rand -base64 32>
ADMIN_PASSWORD=<superadmin-lösenord>
FRONTEND_URL=https://yourdomain.com
SMTP_HOST=mail.example.com
SMTP_PORT=465
SMTP_USER=noreply@example.com
SMTP_PASSWORD=<smtp-lösenord>
SMTP_FROM=Audio Upload <noreply@example.com>
SMTP_SECURE=true
```

```bash
chmod 600 .env
```

## 3. Bygg och starta

```bash
docker compose up -d --build
docker compose ps          # Alla ska vara "healthy"
```

## 4. Skapa första användare

```bash
docker compose exec backend node /app/scripts/reset-for-testing.js
```

Inloggning: `superadmin` / lösenordet du satte som `ADMIN_PASSWORD`.

## 5. Konfigurera nginx

Kopiera exempelkonfigurationen:

```bash
sudo cp nginx-reverse-proxy-example.conf /etc/nginx/sites-available/audio-upload
```

Redigera och ersätt `yourdomain.com` med din domän:

```bash
sudo nano /etc/nginx/sites-available/audio-upload
```

Aktivera:

```bash
sudo ln -s /etc/nginx/sites-available/audio-upload /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Stora filer (Nginx)

Appen är konfigurerad för stora uppladdningar, men om du vill öka gränsen måste du uppdatera alla Nginx-lager som finns i kedjan.

1. Extern reverse proxy (servern):
	- Fil: `/etc/nginx/sites-available/audio-upload`
	- Ändra `client_max_body_size` till önskat värde, t.ex. `4G`
	- Kontrollera att `/api/` har:
	  - `proxy_request_buffering off;`
	  - `proxy_connect_timeout 1800s;`
	  - `proxy_send_timeout 1800s;`
	  - `proxy_read_timeout 1800s;`

2. Frontend-containerns Nginx:
	- Fil i repo: `frontend/nginx.conf`
	- Ändra `client_max_body_size` till samma (eller högre) värde i server/location för `/api`

3. Ladda om/bygg om efter ändring:

```bash
sudo nginx -t && sudo systemctl reload nginx
docker compose up -d --build frontend
```

Tips: Om du kör Cloudflare eller annan proxy framför Nginx kan den ha en egen upload-gräns som måste justeras separat.

## 6. SSL med Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot uppdaterar automatiskt nginx-konfigurationen. Auto-renewal läggs till automatiskt.

## 7. Verifiera

```bash
curl https://yourdomain.com/api/health
# Ska svara {"status":"ok"}
```

Öppna `https://yourdomain.com` i webbläsaren.

---

## Migrera från befintlig installation

### Backup på gamla servern

```bash
docker exec audio-upload-db pg_dump -U audiouser audiodb | gzip > db_backup.sql.gz
tar -czf uploads_backup.tar.gz backend/uploads/
```

### Återställ på nya servern

```bash
# Kopiera hit
scp old-server:~/db_backup.sql.gz .
scp old-server:~/uploads_backup.tar.gz .

# Återställ databas
gunzip -c db_backup.sql.gz | docker exec -i audio-upload-db psql -U audiouser -d audiodb

# Återställ filer
tar -xzf uploads_backup.tar.gz
```

---

## Säkerhet

- Begränsa PostgreSQL till localhost: ändra `"5432:5432"` till `"127.0.0.1:5432:5432"` i docker-compose.yml
- Aktivera brandvägg: `sudo ufw allow 22,80,443/tcp && sudo ufw enable`
- Håll Docker images uppdaterade: `docker compose pull && docker compose up -d --build`

## Felsökning

```bash
docker compose logs -f backend      # Backend-loggar
docker compose logs -f frontend     # Frontend-loggar
sudo tail -f /var/log/nginx/audio-upload-error.log  # Nginx-loggar
```

| Problem | Lösning |
|---|---|
| 502 Bad Gateway | Kontrollera att containers kör: `docker compose ps` |
| Upload timeout | Kontrollera `client_max_body_size 2G` i nginx |
| CORS-fel | Kontrollera att `FRONTEND_URL` i .env matchar din domän |
| Health check unhealthy | Använd `127.0.0.1` istället för `localhost` i health checks |
