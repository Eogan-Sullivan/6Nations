'use strict';
const { X509Certificate, createPublicKey, verify, constants } = require('node:crypto');
const { asn1, pki, pem } = require('node-forge');
const certificates = new WeakMap();
const requests = new WeakMap();
const algorithms = new Map([
  ['1.2.840.113549.1.1.11', 'sha256'],
  ['1.2.840.113549.1.1.12', 'sha384'],
  ['1.2.840.113549.1.1.13', 'sha512'],
]);
const der = value => Buffer.from(asn1.toDer(value).getBytes(), 'binary');
function decode(value) {
  return asn1.fromDer(pem.decode(value)[0].body, true);
}
function algorithm(identifier) {
  const entries = identifier && identifier.value;
  if (!identifier || identifier.tagClass !== asn1.Class.UNIVERSAL || identifier.type !== asn1.Type.SEQUENCE || !identifier.constructed || !Array.isArray(entries) || entries.length < 1 || entries.length > 2 || entries[0].tagClass !== asn1.Class.UNIVERSAL || entries[0].type !== asn1.Type.OID || entries[0].constructed) {
    throw new Error('Invalid signature AlgorithmIdentifier');
  }
  const name = algorithms.get(asn1.derToOid(entries[0].value));
  if (!name) throw new Error('Unsupported signature algorithm: require RSA SHA-256, SHA-384, or SHA-512');
  if (entries.length === 2 && (entries[1].tagClass !== asn1.Class.UNIVERSAL || entries[1].type !== asn1.Type.NULL || entries[1].constructed || entries[1].value !== '')) {
    throw new Error('Invalid RSA signature algorithm parameters');
  }
  return name;
}
function envelope(value) {
  if (!Array.isArray(value.value) || value.value.length !== 3) throw new Error('Invalid signed envelope');
  const name = algorithm(value.value[1]);
  const signature = value.value[2];
  if (signature.type !== asn1.Type.BITSTRING || signature.constructed || signature.value.charCodeAt(0) !== 0) throw new Error('Invalid signature bit string');
  return { name, signature: Buffer.from(signature.value.slice(1), 'binary') };
}
exports.rememberCertificate = (value, original) => certificates.set(value, decode(original));
exports.rememberCSR = (value, original) => requests.set(value, decode(original));
exports.certificate = function(value) {
  const encoded = certificates.get(value) || pki.certificateToAsn1(value);
  const outer = envelope(encoded);
  const tbs = encoded.value[0].value;
  const offset = tbs[0].tagClass === asn1.Class.CONTEXT_SPECIFIC ? 1 : 0;
  const inner = tbs[offset + 1];
  if (algorithm(inner) !== outer.name || !der(inner).equals(der(encoded.value[1]))) throw new Error('Certificate signature algorithms differ');
  const bytes = der(encoded);
  const x509 = new X509Certificate(bytes);
  if (x509.publicKey.asymmetricKeyType !== 'rsa') throw new Error('Certificate requires RSA key');
  return { x509, parsed: pki.certificateFromAsn1(asn1.fromDer(bytes.toString('binary'), true), true) };
};
exports.verifyManifest = function(value, data, signature) {
  const { x509 } = exports.certificate(value);
  return verify('sha256', data, { key: x509.publicKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(signature, 'binary'));
};
exports.verifyCSR = function(value) {
  const encoded = requests.get(value) || pki.certificationRequestToAsn1(value);
  const { name, signature } = envelope(encoded);
  const info = encoded.value[0];
  const parsed = pki.certificationRequestFromAsn1(asn1.fromDer(der(encoded).toString('binary'), true), true);
  if (!parsed.publicKey.n.equals(value.publicKey.n) || !parsed.publicKey.e.equals(value.publicKey.e)) throw new Error('CSR public key does not match signed request');
  const key = createPublicKey(pki.publicKeyToPem(parsed.publicKey));
  if (key.asymmetricKeyType !== 'rsa' || !verify(name, der(info), { key, padding: constants.RSA_PKCS1_PADDING }, signature)) throw new Error('CSR not self-signed');
  return parsed;
};
