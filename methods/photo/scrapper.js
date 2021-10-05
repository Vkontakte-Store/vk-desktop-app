const domino = require('domino')
const urlparse = require('url')
function makeUrlAbsolute(base, relative) {
	const relativeParsed = urlparse.parse(relative)

	if (relativeParsed.host === null) {
		return urlparse.resolve(base, relative)
	}

	return relative
}

function makeUrlSecure(url) {
	return url.replace(/^http:/, 'https:')
}

function parseUrl(url) {
	return urlparse.parse(url).hostname || ''
}

function getProvider(host) {
	return host
		.replace(/www[a-zA-Z0-9]*\./, '')
		.replace('.co.', '.')
		.split('.')
		.slice(0, -1)
		.join(' ')
}

const runRule = function(ruleSet, doc, context) {
	let maxScore = 0
	let value

	for (let currRule = 0; currRule < ruleSet.rules.length; currRule++) {
		const [ query, handler ] = ruleSet.rules[currRule]

		const els = Array.from(doc.querySelectorAll(query))
		if (els.length) {
			for (const el of els) {
				let score = ruleSet.rules.length - currRule

				if (ruleSet.scorer) {
					const newScore = ruleSet.scorer(el, score)

					if (newScore) {
						score = newScore
					}
				}

				if (score > maxScore) {
					maxScore = score
					value = handler(el)
				}
			}
		}
	}

	if (value) {
		if (ruleSet.processor) {
			value = ruleSet.processor(value, context)
		}

		return value
	}

	if ((!value || value.length < 1) && ruleSet.defaultValue) {
		return ruleSet.defaultValue(context)
	}

	return undefined
}


// https://github.com/BetaHuhn/metadata-scraper/blob/master/src/rules.ts
const rules = { 
	title: {
		rules: [
			[ 'meta[property="og:title"][content]', el => el.getAttribute('content') ],
			[ 'meta[name="og:title"][content]', el => el.getAttribute('content') ],
			[ 'meta[property="twitter:title"][content]', el => el.getAttribute('content') ],
			[ 'meta[name="twitter:title"][content]', el => el.getAttribute('content') ],
			[ 'meta[property="parsely-title"][content]', el => el.getAttribute('content') ],
			[ 'meta[name="parsely-title"][content]', el => el.getAttribute('content') ],
			[ 'meta[property="sailthru.title"][content]', el => el.getAttribute('content') ],
			[ 'meta[name="sailthru.title"][content]', el => el.getAttribute('content') ],
			[ 'title', el => el.text ]
		]
	},
	description: {
		rules: [
			[ 'meta[property="og:description"][content]', el => el.getAttribute('content') ],
			[ 'meta[name="og:description"][content]', el => el.getAttribute('content') ],
			[ 'meta[property="description" i][content]', el => el.getAttribute('content') ],
			[ 'meta[name="description" i][content]', el => el.getAttribute('content') ],
			[ 'meta[property="sailthru.description"][content]', el => el.getAttribute('content') ],
			[ 'meta[name="sailthru.description"][content]', el => el.getAttribute('content') ],
			[ 'meta[property="twitter:description"][content]', el => el.getAttribute('content') ],
			[ 'meta[name="twitter:description"][content]', el => el.getAttribute('content') ],
			[ 'meta[property="summary" i][content]', el => el.getAttribute('content') ],
			[ 'meta[name="summary" i][content]', el => el.getAttribute('content') ]
		]
	},
	url: {
		rules: [
			[ 'meta[property="og:url"][content]', el => el.getAttribute('content') ],
			[ 'meta[name="og:url"][content]', el => el.getAttribute('content') ],
			[ 'meta[property="al:web:url"][content]', el => el.getAttribute('content') ],
			[ 'meta[name="al:web:url"][content]', el => el.getAttribute('content') ],
			[ 'meta[property="parsely-link"][content]', el => el.getAttribute('content') ],
			[ 'meta[name="parsely-link"][content]', el => el.getAttribute('content') ],
			[ 'a.amp-canurl', el => el.getAttribute('href') ],
			[ 'link[rel="canonical"][href]', el => el.getAttribute('href') ]
		],
		defaultValue: (context) => context.url,
		processor: (url, context) => makeUrlAbsolute(context.url, url)
	},
    image: {
        rules: [
            [ '#content img[src]', el => el.getAttribute('src') ],
            [ '.content img[src]', el => el.getAttribute('src') ],
            [ 'article img[src]', el => el.getAttribute('src') ],
            [ 'meta[property="og:image:secure_url"][content]', el => el.getAttribute('content') ],
            [ 'meta[name="og:image:secure_url"][content]', el => el.getAttribute('content') ],
            [ 'meta[property="og:image:url"][content]', el => el.getAttribute('content') ],
            [ 'meta[name="og:image:url"][content]', el => el.getAttribute('content') ],
            [ 'meta[property="og:image"][content]', el => el.getAttribute('content') ],
            [ 'meta[name="og:image"][content]', el => el.getAttribute('content') ],
            [ 'meta[property="twitter:image"][content]', el => el.getAttribute('content') ],
            [ 'meta[name="twitter:image"][content]', el => el.getAttribute('content') ],
            [ 'meta[property="twitter:image:src"][content]', el => el.getAttribute('content') ],
            [ 'meta[name="twitter:image:src"][content]', el => el.getAttribute('content') ],
            [ 'meta[property="thumbnail"][content]', el => el.getAttribute('content') ],
            [ 'meta[name="thumbnail"][content]', el => el.getAttribute('content') ],
            [ 'meta[property="parsely-image-url"][content]', el => el.getAttribute('content') ],
            [ 'meta[name="parsely-image-url"][content]', el => el.getAttribute('content') ],
            [ 'meta[property="sailthru.image.full"][content]', el => el.getAttribute('content') ],
            [ 'meta[name="sailthru.image.full"][content]', el => el.getAttribute('content') ],
            [ 'meta[itemprop="image"]', el => el.getAttribute('content') ],
            [ 'img[alt*="author" i]', el => el.getAttribute('src') ],
            [ 'img[src]:not([aria-hidden="true"])', el => el.getAttribute('src') ],
        ],
        processor: (imageUrl, context) => makeUrlAbsolute(context.url, imageUrl)
    }
}


function getMeta(url, html){
    const metadata = {}
    const context = { url, options: { html }}

    const doc = domino.createWindow(html).document
    
    Object.keys(rules).map((key) => {
        metadata[key] = runRule(rules[key], doc, context) || undefined
    })

	return metadata
}

module.exports = getMeta
