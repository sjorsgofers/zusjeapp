/* ------------------------------------------------------------------
   HACCP taken - overgenomen uit de Eurofins/Bureau de Wit app
   ('t Zusje Roermond). Pas hier taken aan; de module leest alleen dit bestand.
------------------------------------------------------------------ */

const AFDELINGEN = ['Warmekant', 'Koudekant', 'Spoelkeuken', 'Bar', 'Algemeen', 'Magazijn'];

const CATEGORIEEN = [
  { id: 'ontvangst',   naam: 'Ontvangst goederen',        icon: '\u{1F69A}' },
  { id: 'temperaturen',naam: 'Temperaturen',              icon: '\u{1F321}' },
  { id: 'kritisch',    naam: 'Kritische processen',       icon: '\u{26A0}'  },
  { id: 'borging',     naam: 'Borging',                   icon: '\u{1F6E1}' },
  { id: 'verificatie', naam: 'Verificatie meetapparatuur',icon: '\u{1F4D0}' },
  { id: 'schoonmaak',  naam: 'Schoonmaak',                icon: '\u{1F9FD}' },
  { id: 'overig',      naam: 'Overige acties',            icon: '\u{1F4CB}' }
];

/* Normkeuzes bij ontvangst goederen.
   limiet = null -> geen temperatuurveld (alleen productnaam + beoordeling) */
const ONTVANGST_NORMEN = [
  { naam: 'Vers | Algemeen',                              limiet: 7,   richting: 'lager' },
  { naam: 'Vers | Verse vis geleverd op ijs (onbewerkt)', limiet: 2,   richting: 'lager' },
  { naam: 'Vers | Orgaanvlees',                           limiet: 3,   richting: 'lager' },
  { naam: 'Vers | Pluimveevlees',                         limiet: 4,   richting: 'lager' },
  { naam: 'Conserven / droge waren',                      limiet: null },
  { naam: 'Diepvries',                                    limiet: -15, richting: 'lager' }
];

/* frequentie:
     {type:'dag'}                        -> elke dag
     {type:'week', dag:4}                -> elke week (1=ma .. 7=zo), deadline die dag
     {type:'weken', n:13, start:'...'}   -> elke n weken vanaf startdatum
   velden: zie renderVeld() in app.js                                   */
const TAKEN = [

  /* ---------------- 1. Ontvangst goederen ---------------- */
  {
    id: 'ontv-koelcel', cat: 'ontvangst', naam: 'Koelcel (Bidfood)', afdeling: '',
    frequentie: { type: 'week', dag: 4 }, handmatig: true,
    instructie: 'Gekoeld product. (Niet warmer dan 7 graden)',
    nvtLabel: 'Leverancier niet geweest',
    velden: [
      { type: 'normkeuze', label: 'Kies een norm', opties: ONTVANGST_NORMEN, standaard: 'Vers | Algemeen' },
      { type: 'tekst', label: 'Productnaam' },
      { type: 'beoordeling', label: 'Beoordeling', items: ['Verpakking', 'Visuele versheid', 'THT'] }
    ]
  },
  {
    id: 'ontv-vriezer', cat: 'ontvangst', naam: 'Vriezer (Bidfood)', afdeling: '',
    frequentie: { type: 'week', dag: 4 }, handmatig: true,
    instructie: 'Meet een bevroren product. (-18)',
    nvtLabel: 'Leverancier niet geweest',
    velden: [
      { type: 'normkeuze', label: 'Kies een norm', opties: ONTVANGST_NORMEN, standaard: 'Diepvries' },
      { type: 'tekst', label: 'Productnaam' },
      { type: 'beoordeling', label: 'Beoordeling', items: ['Verpakking', 'Visuele versheid', 'THT'] }
    ]
  },

  /* ---------------- 2. Temperaturen ---------------- */
  {
    id: 'temp-grill', cat: 'temperaturen', naam: 'Grill Bakplaat', afdeling: 'Warmekant',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet in gebruik',
    velden: [{ type: 'temperatuur', limiet: 4, richting: 'lager' }]
  },
  {
    id: 'temp-koudekant', cat: 'temperaturen', naam: 'Koude kant', afdeling: 'Koudekant',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet in gebruik',
    velden: [{ type: 'temperatuur', limiet: 4, richting: 'lager' }]
  },
  {
    id: 'temp-koelgrill', cat: 'temperaturen', naam: 'Koeling onder de Grill', afdeling: '',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet in gebruik',
    velden: [{ type: 'temperatuur', limiet: 4, richting: 'lager' }]
  },
  {
    id: 'temp-saladiere', cat: 'temperaturen', naam: 'Saladiere koude kant', afdeling: 'Algemeen',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet in gebruik',
    velden: [{ type: 'temperatuur', limiet: 7, richting: 'lager' }]
  },
  {
    id: 'temp-koelcel', cat: 'temperaturen', naam: 'Koelcel', afdeling: '',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet in gebruik',
    velden: [{ type: 'temperatuur', limiet: 7, richting: 'lager' }]
  },
  {
    id: 'temp-vriescel', cat: 'temperaturen', naam: 'Vriescel', afdeling: '',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet in gebruik',
    velden: [{ type: 'temperatuur', limiet: -18, richting: 'lager' }]
  },

  /* ---------------- 3. Kritische processen ---------------- */
  {
    id: 'krit-kerntemp', cat: 'kritisch',
    naam: 'Kerntemperatuur gegaard /bereid component meting 1', afdeling: '',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet van toepassing',
    instructie: 'Product naar keuze. Probeer te variëren.',
    velden: [
      { type: 'tekst', label: 'Productnaam' },
      { type: 'temperatuur', limiet: 75, richting: 'hoger' }
    ]
  },
  {
    id: 'krit-warmhoud', cat: 'kritisch',
    naam: 'Product uit warmhoud voorziening meting 1', afdeling: '',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet van toepassing',
    instructie: 'Product naar keuze. Probeer te variëren.',
    velden: [
      { type: 'tekst', label: 'Productnaam' },
      { type: 'temperatuur', limiet: 60, richting: 'hoger' }
    ]
  },
  {
    id: 'krit-terugkoelen', cat: 'kritisch', naam: 'Terug koelen meting 1', afdeling: '',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet van toepassing',
    instructie: 'Product naar keuze. Probeer te variëren.',
    velden: [
      { type: 'tekst', label: 'Productnaam' },
      { type: 'temperatuur', limiet: 60, richting: 'hoger' },
      { type: 'temperatuur', limiet: 20, richting: 'lager', prefix: 'Richtwaarde', suffix: ' na 2 uur', richtwaarde: true },
      { type: 'temperatuur', limiet: 7,  richting: 'lager', suffix: ' binnen 5 uur' }
    ]
  },
  {
    id: 'krit-frituurpannen', cat: 'kritisch',
    naam: 'Zet hier alle frituurpannen in die je hebt bijv: Frituur 1, Frituur 2 -per meting (ZELF INVULLEN!) TOEVOEGEN',
    afdeling: '', frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet van toepassing',
    instructie: 'Temperatuur mag niet boven de 175 graden uitkomen',
    velden: [{ type: 'temperatuur', limiet: 175, richting: 'lager' }]
  },
  {
    id: 'krit-serveer-koud', cat: 'kritisch', naam: 'Serveer temperatuur (Koud)', afdeling: '',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet van toepassing',
    instructie: 'Product naar keuze. Probeer te variëren.',
    velden: [
      { type: 'tekst', label: 'Productnaam' },
      { type: 'temperatuur', limiet: 7, richting: 'lager' }
    ]
  },
  {
    id: 'krit-serveer-warm', cat: 'kritisch', naam: 'Serveer temperatuur (Warm)', afdeling: '',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet van toepassing',
    instructie: 'Product naar keuze. Probeer te variëren.',
    velden: [
      { type: 'tekst', label: 'Productnaam' },
      { type: 'temperatuur', limiet: 60, richting: 'hoger' }
    ]
  },
  {
    id: 'krit-regenereren', cat: 'kritisch', naam: 'Kerntemperatuur na regenereren', afdeling: '',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet van toepassing',
    instructie: 'Product naar keuze. Probeer te variëren.',
    velden: [
      { type: 'tekst', label: 'Productnaam' },
      { type: 'temperatuur', limiet: 60, richting: 'hoger' },
      { type: 'getal', label: 'Norm: binnen 60 minuten', eenheid: 'min', limiet: 60, richting: 'lager' }
    ]
  },
  {
    id: 'krit-frituur', cat: 'kritisch', naam: 'Frituur', afdeling: 'Warmekant',
    frequentie: { type: 'week', dag: 7 }, nvtLabel: 'Niet van toepassing',
    velden: [{ type: 'temperatuur', limiet: 175, richting: 'lager' }]
  },

  /* ---------------- 5. Verificatie meetapparatuur ---------------- */
  {
    id: 'verif-thermometer', cat: 'verificatie', naam: 'Thermometer registratie', afdeling: '',
    frequentie: { type: 'weken', n: 13, start: '2026-02-02' }, handmatig: true,
    instructie: 'IJkpunten controleren: kokend water en smeltend ijs.',
    nvtLabel: 'Niet van toepassing',
    velden: [
      { type: 'tekst', label: 'Thermometer / apparaat' },
      { type: 'temperatuur', limiet: 100, richting: 'gelijk', label: 'Kokend water, norm: 100°C', marge: 2 },
      { type: 'temperatuur', limiet: 0,   richting: 'gelijk', label: 'Smeltend ijs, norm: 0°C',  marge: 2 }
    ]
  },

  /* ---------------- 7. Overige acties ---------------- */
  {
    id: 'ov-tht', cat: 'overig', naam: 'Controle - THT, FIFO, Coderingen', afdeling: '',
    frequentie: { type: 'dag' }, nvtLabel: 'Niet van toepassing',
    instructie: 'Voedsel scheiden, afdekken',
    velden: [{ type: 'keuze', label: 'Antwoord', opties: ['Gedaan', 'Niet gedaan'] }]
  },
  {
    id: 'ov-vaatwasser', cat: 'overig',
    naam: 'Vaatwasser temperatuur moet hoger zijn dan >60 graden en naspoel >80 graden',
    afdeling: 'Spoelkeuken', frequentie: { type: 'dag' }, nvtLabel: 'Niet van toepassing',
    instructie: 'Display aflezen. Bij afwijkende waarden leiding waarschuwen.',
    velden: [{ type: 'keuze', label: 'Antwoord', opties: ['Gedaan', 'Niet gedaan'] }]
  },
  {
    id: 'ov-ruimtes', cat: 'overig',
    naam: 'Controle - bedrijfsruimtes reinheid en bouwkundige staat',
    afdeling: 'Algemeen', frequentie: { type: 'dag' }, nvtLabel: 'Niet van toepassing',
    instructie: 'Controle op reinheid en bouwkundige staat: Muren, deuren, vloeren, trappen, ' +
      'plafonds, handwasgelegenheden, werkbanken, sanitair, kleedruimte, koelingen, vriezers. ' +
      'Communiceer actiepunten met het team.',
    velden: [{ type: 'keuze', label: 'Antwoord', opties: ['Gedaan', 'Niet gedaan'] }]
  },
  {
    id: 'ov-kalibreren', cat: 'overig', naam: 'Thermometer kalibreren', afdeling: '',
    frequentie: { type: 'weken', n: 52, start: '2027-01-18' }, nvtLabel: 'Niet van toepassing',
    velden: [{ type: 'keuze', label: 'Antwoord', opties: ['Gedaan', 'Niet gedaan'] }]
  }
];
