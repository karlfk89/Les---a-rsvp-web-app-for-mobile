// Abbreviations whose trailing period must not trigger a sentence pause.
// Compared in lower case, including the final period. Words that are also
// ordinary sentence-final words (man, min, jul, ark, red) are left out.

const ENGLISH = [
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'st.', 'vs.', 'etc.', 'e.g.', 'i.e.', 'cf.', 'no.',
  'fig.', 'eq.', 'inc.', 'ltd.', 'co.', 'dept.', 'mt.', 'ft.', 'approx.', 'vol.', 'ch.', 'pp.', 'ed.',
  'gen.', 'gov.', 'capt.', 'col.', 'lt.', 'sgt.', 'rev.', 'hon.', 'messrs.', 'mme.', 'a.m.', 'p.m.',
];

const BOKMAL = [
  'f.eks.', 'bl.a.', 'osv.', 'o.s.v.', 'dvs.', 'd.v.s.', 'ca.', 'nr.', 'kl.', 'mht.', 'm.m.', 'o.l.', 'e.l.',
  'evt.', 'ev.', 'pga.', 'iht.', 'jf.', 'jfr.', 'hhv.', 'inkl.', 'ekskl.', 'tlf.', 'mill.', 'mrd.', 'kr.',
  'ref.', 'vedr.', 'sml.', 'stk.', 'm.fl.', 'f.kr.', 'e.kr.', 'o.a.', 'adm.', 'avd.', 'el.', 'etc.', 'f.o.m.',
  't.o.m.', 'fhv.', 'forts.', 'gl.', 'hr.', 'fr.', 'frk.', 'kap.', 'kgl.', 'mvh.', 'mnd.', 'ang.', 'ss.',
  'st.', 'tidl.', 'tilsv.', 'vha.', 'vs.', 'sek.', 'årh.', 'dr.', 'prof.', 'pr.', 'p.t.', 'm.v.', 'a.s.',
  'bd.', 'jr.', 'sr.', 'ff.', 'pkt.', 'kfr.', 'utg.', 'overs.', 'egtl.',
  'jan.', 'feb.', 'apr.', 'aug.', 'sep.', 'sept.', 'okt.', 'nov.', 'des.',
];

// Nynorsk uses the Bokmål abbreviations plus some of its own.
const NYNORSK_EXTRA = ['t.d.', 'm.a.', 'osb.', 'o.s.b.', 'eigtl.'];

const SETS = {
  en: new Set(ENGLISH),
  nb: new Set(BOKMAL),
  nn: new Set([...BOKMAL, ...NYNORSK_EXTRA]),
};

export function isKnownAbbreviation(word, lang) {
  const set = SETS[lang] || SETS.nb;
  return set.has(word.toLowerCase());
}
