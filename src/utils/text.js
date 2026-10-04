const sanitizeHtml = require('sanitize-html');
const slugify = require('slugify');
const crypto = require('crypto');

// Allow-list tuned to what the Quill editor produces. Everything else is stripped,
// which protects every reader of a post against stored XSS.
const RICH = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li',
    'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'img', 'span', 'sub', 'sup', 'hr'
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    pre: ['spellcheck'],
    '*': ['class']
  },
  allowedClasses: { '*': ['ql-*'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' })
  }
};

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const cleanHtml = (html) => sanitizeHtml(String(html || ''), RICH);

const toText = (html) =>
  decode(
    sanitizeHtml(String(html || '').replace(/<\/(p|h[1-6]|li|pre|blockquote|div)>|<br\s*\/?>/gi, ' '), {
      allowedTags: [],
      allowedAttributes: {}
    })
  )
    .replace(/\s+/g, ' ')
    .trim();

// Plain text field (comments, bios, titles): no markup at all.
const plain = (s, max) =>
  decode(sanitizeHtml(String(s ?? ''), { allowedTags: [], allowedAttributes: {} }))
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);

const excerptOf = (html, n = 200) => {
  const t = toText(html);
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
};

const readingTime = (html) => Math.max(1, Math.ceil(toText(html).split(/\s+/).filter(Boolean).length / 200));

const makeSlug = (title) => {
  const base = slugify(title, { lower: true, strict: true }).slice(0, 80) || 'post';
  return base;
};

const suffix = () => crypto.randomBytes(3).toString('hex');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { cleanHtml, toText, plain, excerptOf, readingTime, makeSlug, suffix, escapeRegex };
