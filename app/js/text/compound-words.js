// Common Norwegian words that often appear as parts of compounds, in bokmål
// and nynorsk spellings. Together with the words of the open book they tell
// where a long compound can be split: «sykehus|parkerings|plassen».
// Inflected forms are recognised from these (plass → plassen, plasser).

export const COMPOUND_WORDS = `
adresse alder alkohol ansvar arbeid arv avdeling avgift avis bad bak bakke bane bank barn barne bil billett
bind blod blomst bok bonde bord born bransje bre brev bro bru bryllup bud bunn butikk by bygd bygg bygning
båt dag dal data del departement dikt direktorat distrikt dom dommer dyr dør eie eiendom eier elv energi
erfaring fag fart familie farge fast felt fest fil film finans fisk fjell fjord fly flyplass folk fond
forbund forening forhold form forsker forskning forsikring fot fred fri fritid frukt fylke fysikk gang gard
gass gate gave gjeld glass grense gruppe grunn gull gutt gård hage hall handel hav helg helse himmel hjelp
hjem hjerne hjerte hode hotell hund hus hytte høst høyskole idrett industri informasjon is jakt jern jobb
jord jul kafé kamp kanal kapital kart katt kirke klasse klima klokke klubb kløver klær kne kokk komité
kommune konge konto kontor kontroll kort kost kraft krig kropp kultur kunde kunnskap kunst kurs kvinne kyrkje
kyst lag land landsby lege legg lekse lerret leilighet lønn leik lek lærar lærer liv lov luft lyd lys
lån makt mann marked mat medisin medlem melk menneske middag miljø minister mor morgen motor musikk møte
mål nasjon natt natur navn namn nett nord nyhet nytt næring offentlig olje omsorg område opp oppgave
opplegg ord orden organisasjon papir park parkering parti pasient pause penge penger person plan plante plass
politi politikk post presse pris produkt program prosjekt rad rapport regel regjering region reise rekke
rente representant rett retts rike ring rom rute råd samfunn samling sang selskap senter side sjef sjø
skatt skip skjema skog skole skule skap skapning skrift slag slott snø sol sommer sone sorg spill sport
språk stasjon stat sted stein stilling stol storting strand strøm student stue styre stykke syke sykehus
system tak tale tann teater tekst tid ting tjeneste tog tre trening tur tv tårn uke ulykke undergang
undervisning ungdom universitet utdanning utvalg vakt valg vann vare vatn veg vei vekst verd verden verk
verksted vind vindu vinter virksomhet vogn vær yrke år øy øye øst vest sør
barnehage jernbane motorvei ungdomsskole videregående grunnskole lufthavn kollektiv
`.trim().split(/\s+/);
