export const APP_VERSION = '1.6.0';

/**
 * Changelog — senaste versionen överst.
 * type: 'new' | 'fix' | 'improve'
 */
export const CHANGELOG = [
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
