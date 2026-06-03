// Test which reference digest is failing
const fs = require('fs');
const forge = require('node-forge');
const { DOMParser, XMLSerializer } = require('xmldom');
const { C14nCanonicalization } = require('xml-crypto/lib/c14n-canonicalization');

const xmlPath = '/home/jordi/Documents/work/webcoop/projectes/projectes/api/face-queue/example/facturae-log.xml';
const xml = fs.readFileSync(xmlPath, 'utf8');

const doc = new DOMParser().parseFromString(xml, 'text/xml');

const c14n = new C14nCanonicalization();
function canonicalize(node) {
	return c14n.process(node, {});
}

function sha1b64(str) {
	return forge.util.encode64(forge.md.sha1.create().update(str, 'utf8').digest().getBytes());
}

// Find Signature
const signatures = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature');
const signature = signatures[0];

// Get embedded digests
const refs = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Reference');
console.log('Number of References:', refs.length);

for (let i = 0; i < refs.length; i++) {
	const ref = refs[i];
	const uri = ref.getAttribute('URI');
	const type = ref.getAttribute('Type');
	const digestEl = ref.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'DigestValue')[0];
	const embeddedDigest = digestEl.textContent;
	console.log(`\n--- Reference ${i}: URI="${uri}" Type="${type}"`);
	console.log(`  Embedded digest: ${embeddedDigest}`);
	
	if (uri === '') {
		// Document with enveloped-signature transform - remove signature, canonicalize whole doc
		const docClone = new DOMParser().parseFromString(xml, 'text/xml');
		const sigToRemove = docClone.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
		sigToRemove.parentNode.removeChild(sigToRemove);
		const canonical = canonicalize(docClone.documentElement);
		const computed = sha1b64(canonical);
		console.log(`  Computed (no sig): ${computed}`);
		console.log(`  Match: ${computed === embeddedDigest}`);
		fs.writeFileSync('/tmp/c14n-doc.xml', canonical);
	} else if (uri.startsWith('#')) {
		const id = uri.substring(1);
		// Find element with this Id
		let target = null;
		const walker = doc.getElementsByTagName('*');
		for (let j = 0; j < walker.length; j++) {
			if (walker[j].getAttribute('Id') === id) {
				target = walker[j];
				break;
			}
		}
		if (!target) { console.log('  Target not found!'); continue; }
		const canonical = canonicalize(target);
		const computed = sha1b64(canonical);
		console.log(`  Computed: ${computed}`);
		console.log(`  Match: ${computed === embeddedDigest}`);
		fs.writeFileSync(`/tmp/c14n-${i}.xml`, canonical);
	}
}
