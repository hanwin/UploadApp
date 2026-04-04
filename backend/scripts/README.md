# Test Data Reset Script

Detta skript återställer databasen och filsystemet till ett rent testtillstånd.

## Vad gör skriptet?

1. **Rensar uploads-katalogen** - Tar bort alla uppladdade filer och mappar
2. **Tömmer databasen** - Raderar all data (filer, mappar, användare, tokens)
3. **Skapar testdata**:
   - 1 Superadmin
   - 1 Admin
   - 3 Vanliga användare (Radioprogram #1, #2, #3)
   - 4 Mappar (en för varje användare)

## Hur kör man skriptet?

### Metod 1: Shell-skript (Enklast)
```bash
./reset-test-data.sh
```

### Metod 2: Docker Exec
```bash
docker compose exec backend node /app/scripts/reset-for-testing.js
```

### Metod 3: NPM Script (inifrån container)
```bash
docker compose exec backend npm run reset-test-data
```

## Skapade användare

| Roll        | Användarnamn  | Lösenord       | Email                                    | Mapp             |
|-------------|---------------|----------------|------------------------------------------|------------------|
| Superadmin  | superadmin    | superadmin123  | superadmin@linkopingsnarradio.se         | -                |
| Admin       | admin         | admin123       | admin@linkopingsnarradio.se              | -                |
| User        | radioprogram1 | radio123       | radioprogram1@linkopingsnarradio.se      | Radioprogram_1   |
| User        | radioprogram2 | radio123       | radioprogram2@linkopingsnarradio.se      | Radioprogram_2   |
| User        | radioprogram3 | radio123       | radioprogram3@linkopingsnarradio.se      | Radioprogram_3   |

## Skapade mappar

- `Radioprogram_1` - För radioprogram1
- `Radioprogram_2` - För radioprogram2
- `Radioprogram_3` - För radioprogram3

## ⚠️ Varning

Detta skript raderar **ALL data** och **ALLA filer**! 
Använd endast för testning och utveckling!

## Testscenario

1. Logga in som `superadmin` / `superadmin123`
2. Se alla mappar och användare
3. Använd "View as"-funktionen för att se som olika användare
4. Testa uppladdning av filer i olika mappar
5. Logga in som `radioprogram1` / `radio123` för att testa vanlig användarupplevelse
