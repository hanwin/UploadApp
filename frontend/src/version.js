export const APP_VERSION = '1.9.4';

/**
 * Changelog — senaste versionen överst.
 * type: 'new' | 'fix' | 'improve'
 */
export const CHANGELOG = [
  {
    version: '1.9.4',
    date: '2026-08-18',
    entries: [
      { type: 'fix', text: 'Arkivering via delete.sh tömmer nu den matchande fileN- och lengthN-referensen i seq-filen utan att ersätta den med en annan fil' },
    ],
  },
  {
    version: '1.9.3',
    date: '2026-08-18',
    entries: [
      { type: 'fix', text: 'Legacy-uppladdningar uppdaterar åter seq-filen direkt efter lyckad uppladdning' },
    ],
  },
  {
    version: '1.9.2',
    date: '2026-08-18',
    entries: [
      { type: 'fix', text: 'Hooklösa legacy-mappar med befintliga ljudfiler får nu automatiskt en seq-fil vid uppstart, utan att en befintlig seq-fil skrivs över' },
    ],
  },
  {
    version: '1.9.1',
    date: '2026-08-18',
    entries: [
      { type: 'improve', text: 'Legacy-mappar utan upload.sh får nu automatiskt den historiska standardmallen <mapp>-tmpl.tmpl utan att befintliga mallar ändras' },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-08-18',
    entries: [
      { type: 'new', text: 'Mappar utan upload.sh använder åter legacy-flödet med .tmpl- och .seq-filer; mappar med upload.sh fortsätter använda hookar' },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08-17',
    entries: [
      { type: 'new', text: 'Admin och superadmin kan nu redigera upload.sh och delete.sh per mapp direkt från webbgränssnittet' },
    ],
  },
  {
    version: '1.7.4',
    date: '2026-08-17',
    entries: [
      { type: 'fix', text: 'Uppgraderingar bevarar nu befintliga .seq- och .tmpl-filer samt äldre databasinställningar, som lämnas orörda men inte längre används' },
    ],
  },
  {
    version: '1.7.3',
    date: '2026-08-16',
    entries: [
      { type: 'improve', text: 'Arkiverade filer behåller nu sitt filnamn och får endast ett löpnummer vid namnkonflikt' },
    ],
  },
  {
    version: '1.7.2',
    date: '2026-08-16',
    entries: [
      { type: 'improve', text: 'Nya och tomma upload.sh-hookar får nu shebang och kommentarer som beskriver alla AUDIO_*-variabler' },
    ],
  },
  {
    version: '1.7.1',
    date: '2026-08-16',
    entries: [
      { type: 'fix', text: 'upload.sh körs nu först för den färdigbearbetade MP3-filen, inte för WAV-originalet som väntar på normalisering' },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-08-16',
    entries: [
      { type: 'new', text: 'Varje ljudmapp har nu egna upload.sh- och delete.sh-hookar som körs vid uppladdning och arkivering' },
      { type: 'improve', text: 'Filer arkiveras nu i mappens arkiv-katalog i stället för att raderas fysiskt, med återställning om en hook misslyckas' },
      { type: 'improve', text: 'Tidigare .seq- och .tmpl-generering samt dess inställningar har tagits bort' },
    ],
  },
  {
    version: '1.6.4',
    date: '2026-06-08',
    entries: [
      { type: 'fix', text: 'Radering tillåts nu för användare med mappbehörighet (inte bara filägare), så filer i tilldelade mappar kan tas bort konsekvent' },
    ],
  },
  {
    version: '1.6.3',
    date: '2026-06-08',
    entries: [
      { type: 'fix', text: 'Radering uppdaterar nu seq för alla fileN/lengthN-poster (inte bara file0), vilket löser mappar med template som använder flera spellisteplatser' },
    ],
  },
  {
    version: '1.6.2',
    date: '2026-06-08',
    entries: [
      { type: 'fix', text: 'Seq-filen töms nu alltid när sista filen i en mapp raderas, även om exakt filmatchning i seq missar' },
    ],
  },
  {
    version: '1.6.1',
    date: '2026-06-08',
    entries: [
      { type: 'fix', text: 'Radering av ljudfil uppdaterar nu seq korrekt: referensen tas bort och om filer finns kvar i mappen används senaste kvarvarande uppladdning, annars lämnas seq tom' },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-06-03',
    entries: [
      { type: 'new', text: 'Aktivitetslogg för admin och superadmin — se inloggningar, uppladdningar och raderingar med tidsstämpel, användare och IP-adress' },
      { type: 'new', text: 'Versionshistorik i appbaren — klicka på versionsnumret för att se ändringar' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-06-02',
    entries: [
      { type: 'fix', text: 'Synk-funktionen importerar nu filer som finns på disk men saknas i databasen (t.ex. efter avbruten uppladdning)' },
      { type: 'fix', text: 'Onödig loggspam från databasanslutningspoolen borttagen' },
      { type: 'improve', text: '.seq- och .tmpl-filer visas korrekt i synksammanfattningen utan att importeras' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-20',
    entries: [
      { type: 'new', text: 'Stöd för publika uppladdningslänkar med tidsbegränsning' },
      { type: 'new', text: 'Schemaläggning av sändningstider för ljudfiler' },
      { type: 'improve', text: 'Förbättrad hantering av MP3-taggar med CP1252-kodning' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-04-10',
    entries: [
      { type: 'new', text: 'Administratörsverktyg för synkronisering av databas och filsystem' },
      { type: 'new', text: 'Möjlighet att lyssna på uppladdade filer direkt i webbläsaren' },
      { type: 'fix', text: 'Rättad hantering av svenska tecken i filnamn' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-03-01',
    entries: [
      { type: 'new', text: 'Rollbaserad åtkomstkontroll: superadmin, admin och användare' },
      { type: 'new', text: 'Mapphantering med tilldelning per användare' },
      { type: 'new', text: 'Möjlighet för admin att se och hantera alla användares filer' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-02-01',
    entries: [
      { type: 'new', text: 'Glömt lösenord — återställning via e-post' },
      { type: 'improve', text: 'Bättre felmeddelanden vid uppladdning' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-15',
    entries: [
      { type: 'new', text: 'Första version — uppladdning av MP3 och WAV' },
      { type: 'new', text: 'Användarregistrering och inloggning med JWT' },
    ],
  },
];
