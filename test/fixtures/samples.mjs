// Original sample texts written for the tests (no copyright concerns).

export const BOKMAL_CHAPTERS = [
  {
    title: 'Kapittel 1',
    paragraphs: [
      'Det var tidlig morgen da Kari gikk ombord på flyet til Tromsø. Hun hadde med seg en bok, en termos og 1 500 kroner i kontanter.',
      '– Skal du lese hele veien? spurte mannen i setet ved siden av.',
      '– Ja. Jeg leser f.eks. alltid når jeg flyr, svarte hun.',
      'Flyet lettet presis kl. 07.15. Sykehusparkeringsplassen under dem ble mindre og mindre, og snart så hun bare skyer.',
    ],
  },
  {
    title: 'Kapittel 2',
    paragraphs: [
      'Boka handlet bl.a. om arbeidsmiljøloven, om 17. mai og om en gammel fyrvokter som het Ørjan Ås.',
      '«Les sakte», hadde bestemoren sagt. «Ordene løper ikke fra deg.»',
      'Men Kari likte å lese fort – kanskje for fort. Hun skrudde opp farten til 450 ord i minuttet og lente seg tilbake.',
    ],
  },
];

export const NYNORSK_TEXT = `Fjellturen

Kapittel 1

Eg veit ikkje kva klokka var då ho kom heim. Det var mørkt, og det snødde.

– Kvar har du vore? spurde mor.

– Berre ute, t.d. på fjellet, sa ho.

Kapittel 2

Dei sat lenge ved bordet og drakk kaffi. Ingen sa noko.
`;

export const ENGLISH_TEXT = `The Window Seat

Chapter 1

She had always preferred the window seat. It was not the view, e.g. the clouds, but the quiet.

"Are you reading the whole way?" he asked.

"Yes. I always read when I fly," she said.
`;

export function bokmalText() {
  return ['Flyturen', '', ...BOKMAL_CHAPTERS.flatMap((chapter) => [chapter.title, '', ...chapter.paragraphs.flatMap((p) => [p, ''])])]
    .join('\n');
}
