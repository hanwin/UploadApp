# Audio Upload App

Webbapplikation för att ladda upp och hantera ljudfiler, byggd med React, Node.js/Express och PostgreSQL. Allt körs i Docker.

## Funktioner

- Uppladdning av MP3/WAV (max 4 GB)
- Rollbaserad åtkomst (superadmin, admin, användare)
- Mappstruktur per användare/program
- JWT-autentisering
- Lösenordsåterställning via e-post
- URL-routing (djuplänkar till mappar)
- WebSocket för realtidsuppdateringar
- UTF-8-stöd i filnamn

## Arkitektur

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│  Frontend   │─────▶│   Backend   │─────▶│  PostgreSQL  │
│ React+Nginx │      │  Express.js │      │              │
│ :81 / :4443 │      │    :5000    │      │    :5432     │
└─────────────┘      └─────────────┘      └──────────────┘
```

Frontend-nginx proxyar `/api` och `/socket.io` till backend.

## Snabbstart

```bash
git clone <repo-url> && cd UploadApp
cp .env.example .env
# Redigera .env – sätt DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD
docker compose up -d --build
# Skapa testanvändare (valfritt)
docker compose exec backend node /app/scripts/reset-for-testing.js
```

Appen nås på `https://localhost:4443` (self-signed cert).

## Konfiguration (.env)

| Variabel | Beskrivning |
|---|---|
| `DB_PASSWORD` | Databaslösenord (används av PostgreSQL och backend) |
| `JWT_SECRET` | Hemlig nyckel för JWT-tokens |
| `ADMIN_PASSWORD` | Lösenord för superadmin-kontot |
| `FRONTEND_URL` | Publik URL, t.ex. `https://upload.example.com` |
| `SMTP_HOST` | SMTP-server (valfritt – krävs för lösenordsåterställning) |
| `SMTP_PORT` | SMTP-port (standard 465) |
| `SMTP_USER` | SMTP-användarnamn |
| `SMTP_PASSWORD` | SMTP-lösenord |
| `SMTP_FROM` | Avsändaradress |

## Uppladdade filer

Filer lagras i `backend/uploads/` (bind-mountad från Docker). Mappstrukturen matchar `disk_name` i databasen.

För säkrare filrättigheter kör backend som icke-root (`PUID`/`PGID` i `.env`).
Sätt dessa till din host-användares UID/GID så att nya filer inte skapas som root.

Exempel (Linux):

```bash
id -u
id -g
```

Om du redan har root-ägda filer i `backend/uploads`, rätta ägarskap en gång:

```bash
sudo chown -R $(id -u):$(id -g) backend/uploads
```

Maximal filstorlek för uppladdning är 4 GB. Om du vill ändra gränsen ytterligare, uppdatera både Nginx-konfigurationen och backend/frontend-valideringen.

### Arkiv och mapp-hookar

Varje ljudmapp innehåller tomma, körbara `upload.sh` och `delete.sh` samt underkatalogen `arkiv/`. När en fil laddas upp körs `upload.sh` efter att filen har sparats och registrerats. För en WAV som ska normaliseras körs hooken i stället först när den färdiga MP3-filen har skapats. När en fil arkiveras flyttas den atomiskt till `arkiv/`, tas bort ur den aktiva listan och `delete.sh` körs.

Hookarna körs med ljudmappen som arbetskatalog och måste avslutas med exitkod `0` inom 30 sekunder. De får kontext i miljövariablerna `AUDIO_EVENT`, `AUDIO_FOLDER`, `AUDIO_FILE_ID`, `AUDIO_FILENAME`, `AUDIO_ORIGINAL_NAME`, `AUDIO_ACTIVE_PATH`, `AUDIO_ARCHIVE_PATH` och `AUDIO_USER_ID`. Arkiverade filer behåller sitt filnamn; vid konflikt läggs ett löpnummer till, exempelvis `program (1).mp3`. Vid hook-fel återställs operationen: en uppladdning arkiveras och dess databasrad tas bort, medan en arkivering flyttas tillbaka till den aktiva mappen och behåller sin databasrad.

Admin och superadmin kan redigera en mapps båda hook-skript från **Mappar** via kodikonen. Endast den registrerade mappens `upload.sh` och `delete.sh` kan läsas eller sparas, och varje skript måste börja med en shebang (till exempel `#!/bin/sh`).

Om `upload.sh` saknas i en mapp används i stället det äldre seq/template-flödet: mappens `.tmpl` används för att skriva `<mapp>-seq.seq`, och schemalagda filer skrivs till `scheduled.seq`. Att skapa eller spara `upload.sh` växlar mappen till hookflödet.

## Vanliga kommandon

```bash
docker compose up -d                          # Starta
docker compose down                            # Stoppa (data bevaras)
docker compose up -d --build                   # Bygga om och starta
docker compose logs -f backend                 # Loggar

# Backup
docker exec audio-upload-db pg_dump -U audiouser audiodb | gzip > backup.sql.gz

# Databasåtkomst
docker exec -it audio-upload-db psql -U audiouser -d audiodb
```

## Deployment på ny server

Se [DEPLOYMENT.md](DEPLOYMENT.md) för fullständiga instruktioner med nginx reverse proxy och Let's Encrypt.

## API-endpoints

| Metod | Endpoint | Beskrivning |
|---|---|---|
| POST | `/api/auth/login` | Logga in |
| POST | `/api/auth/forgot-password` | Återställ lösenord |
| POST | `/api/audio/upload?folder=X` | Ladda upp fil |
| GET | `/api/audio/my-files` | Mina filer |
| DELETE | `/api/audio/:id` | Arkivera fil |
| GET | `/api/folders` | Lista mappar |
| POST | `/api/folders` | Skapa mapp |
| GET | `/api/users` | Lista användare (admin) |
| POST | `/api/users` | Skapa användare (admin) |
| GET | `/api/health` | Health check |
