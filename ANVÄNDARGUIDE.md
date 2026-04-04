# Användarguide - Audio Upload App

## Innehåll
1. [Introduktion](#introduktion)
2. [Komma igång](#komma-igång)
3. [För vanliga användare](#för-vanliga-användare)
4. [För administratörer](#för-administratörer)
5. [För superadministratörer](#för-superadministratörer)
6. [Schemaläggning av uppladdningar](#schemaläggning-av-uppladdningar)
7. [Tips och tricks](#tips-och-tricks)

---

## Introduktion

Audio Upload App är ett säkert system för att ladda upp, hantera och processera ljudfiler, speciellt anpassat för radioverksamhet. Systemet har tre olika användarroller med olika behörigheter:

- **Användare** - Kan ladda upp och hantera sina egna ljudfiler i sin tilldelade mapp
- **Admin** - Kan se och hantera alla användare, ladda upp till användares mappar, men kan inte ändra systeminställningar
- **Superadmin** - Full kontroll över hela systemet inklusive användarhantering, alla filer och kan ladda upp till alla användares mappar

---

## Komma igång

### Första inloggningen

1. Öppna webbläsaren och gå till applikationens adress (t.ex. `https://localhost:4443`)
2. Du möts av en inloggningssida med fält för användarnamn och lösenord
3. Ange dina inloggningsuppgifter som du fått av administratören
4. Klicka på **"Logga in"**

### Om du glömt ditt lösenord

1. Klicka på länken **"Glömt lösenord?"** under inloggningsknappen
2. Ange din e-postadress
3. Klicka på **"Skicka återställningslänk"**
4. Du får ett e-postmeddelande med en länk för att återställa lösenordet (från systemets SMTP-server)
5. Följ instruktionerna i e-postmeddelandet
6. Skapa ett nytt lösenord (minst 12 tecken med stora/små bokstäver, siffror och specialtecken)
7. Logga in med ditt nya lösenord

### Ändra ditt lösenord

1. Klicka på **profilikonen** (👤) i övre högra hörnet
2. Välj **"Min profil"**
3. En dialog öppnas där du kan:
   - Ändra din e-postadress
   - Byta lösenord (kräver ditt nuvarande lösenord)
4. Använd **🔄-knappen** för att automatiskt generera ett säkert lösenord
5. Använd **📋-knappen** för att kopiera det genererade lösenordet
6. Klicka **"Spara"**

---

## För vanliga användare

Som vanlig användare är din huvuduppgift att ladda upp och hantera ljudfiler i din tilldelade mapp.

### Översikt över din sida

När du loggat in ser du:
- **Rubrik** med ditt mapnamn (t.ex. "Radioprogram #1")
- **Uppladdningsområde** högst upp där du kan dra-och-släppa filer eller klicka för att välja filer
- **Fillista** som visar alla dina uppladdade filer i ett kort-format
- **Profilmeny** i övre högra hörnet där du kan logga ut

### Ladda upp en ljudfil

#### Alternativ 1: Dra och släpp
1. Dra en ljudfil (MP3 eller WAV) från din dator
2. Släpp filen över uppladdningsområdet där det står "Dra ljudfiler hit eller klicka för att välja"
3. Filen börjar laddas upp direkt

#### Alternativ 2: Välj fil
1. Klicka på uppladdningsområdet
2. En filväljare öppnas
3. Navigera till din ljudfil och välj den
4. Klicka **"Öppna"**

#### Om du laddar upp en WAV-fil
När du valt en WAV-fil får du en dialogruta med frågan: **"Vill du processa ljudfilen för radiosändning?"**

**Tre alternativ:**
- **Avbryt** - Avbryter uppladdningen helt
- **Nej, ladda bara upp** - Laddar upp WAV-filen som den är
- **Ja, processa filen** - Laddar upp och processar filen automatiskt

**Om du väljer "Ja, processa filen":**
- Du kan kryssa i **"Radera original-WAV efter lyckad processning"** om du vill spara utrymme
- Filen laddas upp och börjar processas i bakgrunden
- Processningen normaliserar ljudnivåer enligt EBU R128-standarden (perfekt för radiosändning)
- Filen konverteras till MP3 (192 kbps)
- Du får ett meddelande när processningen är klar
- Den processade MP3-filen visas automatiskt i din fillista

**Filstatus under processning:**
- **Laddar upp...** - Filen skickas till servern
- **Väntar på processning...** - Filen står i kö
- **Processas...** - Ljudfilen bearbetas (kan ta 1-2 minuter beroende på filstorlek)
- **Klar** - Filen är redo att användas

### Hantera dina filer

Varje fil visas som ett kort med följande information:
- **Filnamn** - Namnet på filen
- **Filstorlek** - Hur stor filen är (MB eller KB)
- **Uppladdningsdatum** - När filen laddades upp
- **Status** - Om filen processas eller är klar
- **Åtgärdsknappar** - Play och Radera

#### Lyssna på en fil
1. Klicka på **Play-knappen** (▶️) på filkortet
2. En ljudspelare öppnas i en popup med:
   - Play/Pause-knapp
   - Tidslinje med spolare
   - Volymkontroll
   - Aktuell tid / total tid
3. Klicka på krysset eller utanför popupen för att stänga spelaren

#### Schemalägg uppladdning
1. Klicka på **klockikonen** (🕐) bredvid "Schemalägg"
2. En dialogruta öppnas där du kan välja datum och tid för publicering
3. Filen laddas upp direkt men blir INTE synlig förrän det schemalagda datumet
4. Du ser en timer bredvid filen som visar när den publiceras

**Användningsfall:**
- Förbereda innehåll i förväg
- Schemalägga publicering till specifik tidpunkt
- Planera veckoinnehåll

#### Radera en fil
1. Klicka på **papperskorgen** (🗑️) på filkortet
2. En bekräftelsedialog visas: "Är du säker på att du vill radera denna fil?"
3. Klicka **"Radera"** för att bekräfta
4. Filen tas bort permanent från systemet

### Meddelanden och notifikationer

Systemet visar meddelanden (toast notifications) för viktiga händelser:
- ✅ **Grön** - Lyckad åtgärd (t.ex. "Fil uppladdad!")
- ❌ **Röd** - Fel eller problem (t.ex. "Uppladdning misslyckades")
- ℹ️ **Blå** - Information (t.ex. "Processning påbörjad")

### Logga ut
1. Klicka på din **profilikon** i övre högra hörnet
2. Välj **"Logga ut"** från menyn
3. Du loggas ut och återkommer till inloggningssidan

---

## För administratörer

Som administratör har du tillgång till användarhantering och kan se alla filer i systemet.

### Din instrumentpanel

När du loggat in som admin ser du tre flikar:
- **Ljudfiler** - Visa och hantera alla ljudfiler i systemet
- **Mappar** - Hantera mappar (vyer av olika användares innehåll)
- **Användare** - Skapa, redigera och hantera användarkonton

### Flik: Ljudfiler

Här ser du ALLA ljudfiler från alla användare i systemet.

**Som Admin/Superadmin kan du:**
- Välja en specifik mapp i dropdown-menyn högst upp
- Ladda upp filer direkt till användarens mapp
- Filer du laddar upp får automatiskt den mapp användaren som äger
- Lyssna på alla filer med play-knappen
- Radera filer (även andras filer - var försiktig!)
- Se vilken mapp/användare som äger varje fil

**Fillistan visar:**
- Filnamn
- Filstorlek  
- Mapp (vilken användare som äger filen)
- Uppladdad (datum och tid)
- Status (klar, processas, schemalagd, etc.)
- Åtgärder (Play och Radera)

**Användningsfall:**
- Ladda upp innehåll åt användare som inte har tillgång
- Granska uppladdade filer
- Ta bort olämpligt innehåll
- Hjälpa användare med filproblem
- Övervaka systemets innehåll

### Flik: Mappar

Här ser du en översikt över alla mappar i systemet.

**Mapplistan visar:**
- Mappnamn (t.ex. "Radioprogram_1")
- Antal filer i mappen
- Åtgärd: Visa filer

**Du kan:**
- Klicka **"Visa filer"** för att se alla filer i en specifik mapp
- Få en snabb överblick över hur mycket innehåll varje användare har

**Användningsfall:**
- Kontrollera vilka användare som är aktiva
- Se vilka mappar som har mycket innehåll
- Få överblick över systemets struktur

### Flik: Användare

Här hanterar du alla användarkonton (förutom superadmins).

**Användarlistan visar:**
- ID-nummer
- Användarnamn
- E-postadress
- Roll (User eller Admin)
- Mapp (vilken mapp användaren är kopplad till, "-" för admins)
- Åtgärder (Visa som [endast för vanliga användare], Redigera, Radera)

#### Skapa ny användare
1. Klicka på **"Skapa ny användare"** högst upp
2. En dialogruta öppnas
3. Fyll i:
   - **Användarnamn** (unikt, kan inte ändras senare)
   - **E-postadress** (måste vara giltig)
   - **Lösenord** (minst 12 tecken) - använd **🔄-knappen** för att generera ett säkert lösenord
   - **Roll** (välj User eller Admin)
   - **Mapp** (endast synlig för vanliga användare):
     - Välj en befintlig mapp från listan
     - **ELLER** välj "+ Skapa ny mapp..." längst ner i listan
     - Om du väljer att skapa ny mapp, ange mappnamn i fältet som dyker upp
4. Klicka **"Skapa användare"**

**Tips:**
- Använd lösenordsgeneratorn (🔄) för att skapa säkra lösenord
- Kopiera lösenordet (📋) för att skicka till användaren via säker kanal
- Användarnamn kan inte ändras senare
- Vanliga användare MÅSTE ha en mapp
- Admins får INTE ha en mapp (mappvalet döljs automatiskt)

#### Redigera användare
1. Klicka på **pennikonen** (✏️) vid användaren
2. En dialogruta öppnas med användarens information
3. Du kan ändra:
   - E-postadress
   - Lösenord (lämna tomt för att inte ändra) - använd **🔄-knappen** för att generera nytt lösenord
   - Bekräfta lösenord (fylls i automatiskt vid generering)
4. Klicka **"Spara ändringar"**

**Viktigt:**
- Använd lösenordsgeneratorn för att skapa säkra lösenord
- Kopiera det genererade lösenordet och skicka till användaren
- Användarnamn och roll kan inte ändras här

#### Visa som användare (Impersonation)
En kraftfull funktion för support och felsökning - **endast för vanliga användare**!

**Notera:** Denna funktion är INTE tillgänglig för admin-användare av säkerhetsskäl.

1. Klicka på **ögat-ikonen** (👁️) vid användaren (visas endast för vanliga användare)
2. Du loggas automatiskt in som den användaren
3. Du ser exakt vad användaren ser
4. Du kan testa funktioner och hjälpa till med problem
5. I övre högra hörnet ser du en **gul varning**: "Inloggad som: [användarnamn]"
6. Klicka på **"Återgå till [ditt användarnamn]"** för att återgå till ditt eget konto

**Användningsfall:**
- Hjälpa användare som har problem
- Testa behörigheter
- Demonstrera funktioner
- Felsöka rapporterade problem
- Ladda upp filer åt användaren

**Säkerhetsnotering:**
- Alla åtgärder du gör loggas under den personifierade användaren
- Använd denna funktion ansvarsfullt
- Informera gärna användaren innan du personifierar dem
- Funktionen är INTE tillgänglig för andra administratörer

#### Radera användare
1. Klicka på **papperskorgen** (🗑️) vid användaren
2. En varningsdialog visas: "Är du säker på att du vill radera denna användare?"
3. Klicka **"Radera"** för att bekräfta

**VARNING:**
- Detta raderar användaren permanent
- Alla användarens filer och mapp förblir i systemet
- Detta kan inte ångras

### Begränsningar som Admin

Som admin kan du INTE:
- Skapa eller redigera superadministratörer
- Se eller ändra superadmins i användarlistan
- Använda "Visa som" på andra administratörer (endast på vanliga användare)
- Ändra systeminställningar
- Få tillgång till databas- eller serverfiler direkt

---

## För superadministratörer

Som superadministratör har du full kontroll över hela systemet. Du har alla samma funktioner som en admin, PLUS:

### Ytterligare behörigheter

#### Användarhantering
- Se och hantera ALLA användare inklusive andra superadmins
- Skapa nya superadministratörer
- Ändra någon användares roll till superadmin
- Radera superadmins (om det finns fler än en)
- Redigera e-post och lösenord för alla användare

#### Profilhantering
- Klicka på **profilikonen** (👤) i övre högra hörnet
- Välj **"Min profil"** för att ändra din egen e-post och lösenord
- Använd lösenordsgeneratorn (🔄) för att skapa säkra lösenord

#### Systemåtkomst
- Full åtkomst till databashantering
- Kan köra administrativa skript
- Kan återställa systemet för testning
- Tillgång till serverloggar och felsökningsverktyg

### Skapa en Superadmin

1. Gå till fliken **"Användare"**
2. Klicka **"Skapa ny användare"**
3. Fyll i uppgifter som vanligt
4. Välj **"Superadmin"** som roll (om tillgängligt)
5. Superadmins får INGEN mapp (automatiskt)
6. Använd lösenordsgeneratorn för att skapa ett starkt lösenord
7. Klicka **"Skapa användare"**

### Säkerhetsansvar

Som superadmin har du stort ansvar:

**GÖR:**
- ✅ Skapa starka lösenord
- ✅ Logga ut efter varje session
- ✅ Regelbundet granska användarkonton
- ✅ Ta backup på systemet
- ✅ Övervaka systemloggar för misstänkt aktivitet
- ✅ Radera inaktiva konton

**GÖR INTE:**
- ❌ Dela dina inloggningsuppgifter
- ❌ Lämna datorn inloggad obevakad
- ❌ Radera viktiga systemfiler
- ❌ Ge superadmin-behörighet i onödan
- ❌ Personifiera användare utan orsak

### Systemunderhåll

Som superadmin kan du utföra underhållsåtgärder:

#### Återställa testsystem
Om du har tillgång till servern kan du köra:
```bash
cd /path/to/UploadApp
docker compose exec backend node /app/scripts/reset-for-testing.js
```

Detta skapar:
- En superadmin (med genererat lösenord)
- En admin (med genererat lösenord)
- Tre testanvändare med mappar

**VARNING:** Detta raderar ALL data!

#### Hantera databas
Du kan ansluta till databasen direkt för avancerad hantering:
```bash
docker exec -it audio-upload-db psql -U audiouser -d audiodb
```

#### Se serverloggar
```bash
# Backend-loggar
docker logs audio-upload-backend -f

# Frontend-loggar  
docker logs audio-upload-frontend -f

# Databas-loggar
docker logs audio-upload-db -f
```

---

## Schemaläggning av uppladdningar

Alla användare (vanliga användare, admins och superadmins) kan schemalägga när en uppladdad fil ska bli synlig.

### Hur det fungerar

1. Ladda upp en fil som vanligt
2. När filen är uppladdad, klicka på **klockikonen** (🕐) och texten **"Schemalägg"** bredvid filen
3. En dialog öppnas med:
   - Datumväljare (kalender)
   - Tidsväljare (timmar och minuter)
4. Välj när filen ska publiceras/bli synlig
5. Klicka **"Schemalägg"**
6. Filen visas nu med en **timer** som räknar ner till publicering

### Vad händer

**Innan schemalagd tid:**
- Filen är uppladdad och finns i systemet
- Filen är INTE synlig för andra användare (förutom admins/superadmins)
- En nedräkningstimer visar hur lång tid som återstår
- Du kan fortfarande lyssna på filen själv

**Vid schemalagd tid:**
- Filen blir automatiskt synlig
- Timern försvinner
- Filen behandlas som en vanlig, publicerad fil

### Användningsfall

- **Förbereda program i förväg** - Ladda upp hela veckans program på en gång
- **Tidsstyrda releaser** - Publicera intervjuer eller segment vid specifika tidpunkter
- **Planerad publicering** - Schemalägg morgonprogram kvällen innan
- **Automatisk hantering** - Slipp tänka på att manuellt publicera innehåll vid rätt tidpunkt

### Tips

- Schemalägga flera filer samtidigt för ett helt program
- Använd beskrivande filnamn för att hålla ordning
- Kontrollera att datum och tid är korrekt innan du schemalägger
- Admins kan se alla schemalagda filer och deras publiceringsdatum

---

## Tips och tricks

### För alla användare

**Filformat:**
- Stöder MP3 och WAV-filer
- Max filstorlek: 2 GB per fil
- Rekommenderad MP3-kvalitet: 192 kbps eller högre

**Filnamn:**
- Använd beskrivande filnamn (t.ex. "Intervju_2024-01-24.mp3")
- Undvik specialtecken (åäö fungerar bra)
- Datuming i filnamn hjälper till med sortering

**Lösenord:**
- Minst 12 tecken krävs
- Blanda stora och små bokstäver, siffror och specialtecken
- Använd lösenordsgeneratorn (🔄) för automatisk generering av säkra lösenord
- Kopiera lösenordet (📋) direkt efter generering
- Byt lösenord regelbundet via profilmenyn

**Processning för radio:**
- Använd alltid processning för WAV-filer som ska sändas
- Processningen normaliserar ljudnivåer (EBU R128-standard)
- Komprimerar dynamiken för jämnare ljudnivå
- Konverterar till MP3 för mindre filstorlek
- Processen tar 1-2 minuter per fil

**Säkerhet:**
- Logga ut när du är klar
- Använd unika, starka lösenord
- Byt lösenord regelbundet
- Dela aldrig dina inloggningsuppgifter

### För administratörer

**Användarhantering:**
- Skapa användare med tydliga namn (t.ex. program-/redaktionsnamn)
- Använd lösenordsgeneratorn för att skapa säkra lösenord
- Kopiera och skicka lösenord via säker kanal (inte e-post)
- Granska användarlistan regelbundet
- Ta bort inaktiva konton

**Mappar:**
- En mapp per program/redaktion
- Tydliga mappnamn (t.ex. "Morgonekot", "Sportredaktionen")
- Använd "+ Skapa ny mapp..." när du skapar användare
- Kontrollera regelbundet hur mycket utrymme som används

**Uppladdning åt användare:**
- Välj rätt mapp i dropdown-menyn innan uppladdning
- Filer får automatiskt rätt ägare baserat på vald mapp
- Använd "Visa som" för att testa som användaren ser det

**Support:**
- Använd "Visa som"-funktionen för att hjälpa användare (endast för vanliga användare)
- Dokumentera vanliga problem och lösningar
- Kommunicera systemändringar till användarna

### För superadmins

**Säkerhet först:**
- Ha minst två superadmin-konton (om en låses ute)
- Använd alltid lösenordsgeneratorn för nya konton
- Dokumentera superadmin-inloggningar
- Granska adminaktivitet regelbundet
- Håll systemet uppdaterat

**Backup:**
- Ta regelbundna backuper av databasen
- Säkerhetskopiera uppladdade filer
- Testa återställningsprocessen
- Spara backuper på säker plats

**Prestanda:**
- Övervaka diskutrymme
- Rensa gamla, oanvända filer
- Kontrollera systemloggar för fel
- Optimera databas vid behov

---

## Vanliga frågor

**F: Hur stor får en fil vara?**  
S: Max 2 GB per fil.

**F: Vilka filformat stöds?**  
S: MP3 och WAV.

**F: Hur lång tid tar processning?**  
S: Vanligtvis 1-2 minuter beroende på filstorlek.

**F: Kan jag ångra en borttagning?**  
S: Nej, borttagna filer är permanent raderade. Var försiktig!

**F: Kan jag ladda upp flera filer samtidigt?**  
S: Nej, för närvarande en fil i taget.

**F: Vad händer om processningen misslyckas?**  
S: Du får ett felmeddelande. Filen finns kvar som original-WAV. Prova ladda upp igen.

**F: Kan andra användare se mina filer?**  
S: Nej (som vanlig användare). Endast admins och superadmins kan se alla filer.

**F: Kan jag ändra mitt användarnamn?**  
S: Nej, kontakta en administratör om du behöver ändra användarnamn.

**F: Hur återställer jag mitt lösenord?**  
S: Använd "Glömt lösenord?"-länken på inloggningssidan.

**F: Hur skapar jag ett säkert lösenord?**  
S: Använd lösenordsgeneratorn (🔄-knappen) i lösenordsfältet. Den skapar automatiskt ett säkert lösenord på 16 tecken med blandning av stora/små bokstäver, siffror och specialtecken.

**F: Kan jag schemalägga flera filer samtidigt?**  
S: Ja, du kan schemalägga varje fil individuellt till olika tidpunkter.

**F: Vad är skillnaden mellan "Visa som" och att logga in som användaren?**  
S: "Visa som" låter en admin temporärt se systemet från användarens perspektiv utan att behöva användarens lösenord. Du kan enkelt växla tillbaka.

**F: Kan admins använda "Visa som" på andra admins?**  
S: Nej, av säkerhetsskäl kan "Visa som" endast användas på vanliga användare.

**F: Hur vet jag vilken mapp en fil kommer laddas upp till?**  
S: Som admin/superadmin ser du vald mapp i dropdown-menyn högst upp. Filer får automatiskt den mappens ägare.

---

## Support

Vid problem, kontakta din systemadministratör.

**Systemversion:** 2.0  
**Senast uppdaterad:** 2026-01-25
