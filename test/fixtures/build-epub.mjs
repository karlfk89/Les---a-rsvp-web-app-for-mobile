// Builds small EPUB files in memory for the importer tests.
import { strToU8, zipSync } from 'fflate';

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function chapterDocument(chapter, id) {
  const body = chapter.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${escape(chapter.title)}</title><style>p { margin: 0 }</style></head>
<body><section id="${id}"><h1>${escape(chapter.title)}</h1>
${body}
<p><a id="${id}-end"/></p></section></body></html>`;
}

export function buildEpub({ title, author = '', lang = 'nb', chapters, version = 3, encryption = null }) {
  const files = {
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`),
  };
  if (encryption) files['META-INF/encryption.xml'] = strToU8(encryption);

  const manifest = [];
  const spine = [];
  chapters.forEach((chapter, i) => {
    const name = `text/kapittel%20${i + 1}.xhtml`;
    files[`OEBPS/text/kapittel ${i + 1}.xhtml`] = strToU8(chapterDocument(chapter, `c${i + 1}`));
    manifest.push(`<item id="c${i + 1}" href="${name}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="c${i + 1}"/>`);
  });

  const navPoints = chapters.map((chapter, i) => `<navPoint id="n${i + 1}" playOrder="${i + 1}">
  <navLabel><text>${escape(chapter.title)}</text></navLabel><content src="text/kapittel%20${i + 1}.xhtml"/></navPoint>`);
  files['OEBPS/toc.ncx'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap>
<navPoint id="cover" playOrder="0"><navLabel><text>Omslag</text></navLabel><content src="text/kapittel%201.xhtml"/></navPoint>
${navPoints.join('\n')}
</navMap></ncx>`);
  manifest.push('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');

  if (version === 3) {
    const links = chapters.map((chapter, i) =>
      `<li><a href="text/kapittel%20${i + 1}.xhtml#c${i + 1}">${escape(chapter.title)}</a></li>`);
    files['OEBPS/nav.xhtml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Innhold</title></head>
<body><nav epub:type="toc"><h1>Innhold</h1><ol>${links.join('')}</ol></nav></body></html>`);
    manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  }

  files['OEBPS/content.opf'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${version}.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">test</dc:identifier>
    <dc:title>${escape(title)}</dc:title>
    ${author ? `<dc:creator>${escape(author)}</dc:creator>` : ''}
    <dc:language>${lang}</dc:language>
  </metadata>
  <manifest>${manifest.join('\n')}</manifest>
  <spine toc="ncx">${spine.join('\n')}</spine>
</package>`);

  return zipSync(files);
}
