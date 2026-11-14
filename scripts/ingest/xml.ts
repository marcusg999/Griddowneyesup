/**
 * A very small XML reader, shared by the sources that parse XML.
 *
 * Deliberately not a parser. It reads named elements out of documents whose
 * shape is already known, which is all any source here needs, and it keeps the
 * dependency list at zero for a build that runs in two CI systems.
 *
 * What that costs, stated plainly so nobody mistakes it for a general tool: it
 * does not understand namespaces, attributes, or nesting of an element inside
 * itself. Every caller checks what it got afterwards — the brief schema
 * refuses a malformed item — so a mis-read drops an item rather than
 * corrupting a digest.
 *
 * Shared because two sources read XML now: the publisher feeds, and the FAA's
 * airspace status. Two copies of an entity decoder is two places for the
 * `&amp;lt;` case below to be got wrong.
 */

/** The five XML entities, plus numeric escapes. Nothing else is interpreted. */
export function decodeXml(raw: string): string {
  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Ampersand last, so `&amp;lt;` decodes to the text `&lt;` rather than to
    // a tag bracket. Decoding it first would let an encoded entity escape.
    .replace(/&amp;/g, '&');
}

/** The inner text of each `<tag>…</tag>`, in document order. */
export function blocks(xml: string, tag: string): string[] {
  const found: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  let match = re.exec(xml);
  while (match) {
    found.push(match[1] ?? '');
    match = re.exec(xml);
  }
  return found;
}

/**
 * The text of the first `<tag>` in a block, CDATA unwrapped and decoded.
 *
 * Self-closing tags are deliberately not matched: `<title/>` has no text, and
 * treating it as empty string rather than as absent would hide a feed that
 * has changed shape behind an item that silently fails validation later.
 */
export function tagText(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const match = re.exec(block);
  if (!match) return undefined;
  const raw = (match[1] ?? '').trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(raw);
  const text = cdata ? (cdata[1] ?? '') : decodeXml(raw);
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > 0 ? collapsed : undefined;
}
