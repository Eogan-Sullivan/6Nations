'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const workspaceRequire = require('node:module').createRequire(path.resolve(__dirname, '../../frontend/package.json'));
const forge = workspaceRequire('node-forge');
const api = process.env.SECURITY_SIGNING_PATH ? require(process.env.SECURITY_SIGNING_PATH) : workspaceRequire('@expo/code-signing-certificates');
function keys() {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return api.convertKeyPairPEMToKeyPair({ privateKeyPEM: pair.privateKey.export({ type: 'pkcs1', format: 'pem' }), publicKeyPEM: pair.publicKey.export({ type: 'spki', format: 'pem' }) });
}
const pair = keys();
const other = keys();
function certificate(options = {}) {
  return api.generateSelfSignedCodeSigningCertificate({ keyPair: pair, commonName: 'security-test', validityNotBefore: new Date(Date.now() - 60000), validityNotAfter: new Date(Date.now() + 60000), ...options });
}
function issue(csr) { return api.generateDevelopmentCertificateFromCSR(pair.privateKey, certificate(), csr, 'app', 'scope'); }
function poison(value, key = 'verify') { value[key] = () => { throw new Error('Forge verification called'); }; }
test('valid certificates and manifest verification never call Forge verify', () => {
  const cert = certificate(); poison(cert); cert.publicKey = { ...cert.publicKey, verify: () => { throw new Error('Forge verification called'); } };
  api.validateSelfSignedCertificate(cert, pair);
  const signature = api.signBufferRSASHA256AndVerify(pair.privateKey, cert, Buffer.from('manifest'));
  assert.equal(crypto.verify('sha256', Buffer.from('manifest'), forge.pki.publicKeyToPem(pair.publicKey), Buffer.from(signature, 'base64')), true);
  assert.throws(() => api.signBufferRSASHA256AndVerify(other.privateKey, cert, Buffer.from('manifest')), /not valid/);
});
test('certificate dates, usage extensions, issuer, and key matching stay enforced', () => {
  assert.throws(() => api.validateSelfSignedCertificate(certificate({ validityNotBefore: new Date(0), validityNotAfter: new Date(1000) }), pair), /expired/);
  assert.throws(() => api.validateSelfSignedCertificate(certificate({ validityNotBefore: new Date(Date.now() + 60000), validityNotAfter: new Date(Date.now() + 120000) }), pair), /expired/);
  for (const name of ['keyUsage', 'extKeyUsage']) {
    const cert = certificate(); cert.setExtensions(cert.extensions.filter(x => x.name !== name)); cert.sign(pair.privateKey, forge.md.sha256.create());
    assert.throws(() => api.validateSelfSignedCertificate(cert, pair), /not present/);
  }
  const cert = certificate(); cert.setIssuer([{ name: 'commonName', value: 'different' }]); cert.sign(pair.privateKey, forge.md.sha256.create());
  assert.throws(() => api.validateSelfSignedCertificate(cert, pair), /issuer/);
  assert.throws(() => api.validateSelfSignedCertificate(certificate(), other), /public key|pubic key/);
  assert.throws(() => api.validateSelfSignedCertificate(certificate(), { publicKey: pair.publicKey, privateKey: other.privateKey }), /key mismatch/);
});
test('CSR native verification accepts original DER and rejects altered signed data and keys', () => {
  const csr = api.generateCSR(pair, 'csr'); poison(csr); csr.publicKey = { ...csr.publicKey, verify: () => { throw new Error('Forge verification called'); } }; issue(csr);
  const tampered = api.generateCSR(pair, 'csr'); tampered.certificationRequestInfo.value[1].value[0].value[0].value[1].value = 'tampered';
  assert.throws(() => issue(tampered), /CSR not self-signed/);
  const wrong = api.generateCSR(pair, 'csr'); wrong.publicKey = other.publicKey;
  assert.throws(() => issue(wrong), /CSR public key|CSR not self-signed/);
});
test('RSA SHA256, SHA384, SHA512 are accepted; weak and PSS algorithms are rejected', () => {
  for (const hash of ['sha256', 'sha384', 'sha512']) {
    const cert = certificate(); cert.sign(pair.privateKey, forge.md[hash].create()); api.validateSelfSignedCertificate(cert, pair);
    const csr = api.generateCSR(pair, 'csr'); csr.sign(pair.privateKey, forge.md[hash].create()); issue(csr);
  }
  for (const hash of ['sha1', 'md5']) {
    const cert = certificate(); cert.sign(pair.privateKey, forge.md[hash].create()); assert.throws(() => api.validateSelfSignedCertificate(cert, pair), /Unsupported signature algorithm/);
    const csr = api.generateCSR(pair, 'csr'); csr.sign(pair.privateKey, forge.md[hash].create()); assert.throws(() => issue(csr), /Unsupported signature algorithm/);
  }
  for (const oid of ['1.2.840.113549.1.1.10', '1.2.3.4']) {
    const csr = api.generateCSR(pair, 'csr'); csr.signatureOid = oid; assert.throws(() => issue(csr));
  }
});
test('certificate policy reads signed ASN1 rather than mutable signature or usage fields', () => {
  const cert = certificate(); cert.sign(pair.privateKey, forge.md.sha1.create()); cert.signatureOid = forge.pki.oids.sha256WithRSAEncryption;
  assert.throws(() => api.validateSelfSignedCertificate(cert, pair), /Unsupported signature algorithm/);
  const missing = certificate(); missing.setExtensions([]); missing.sign(pair.privateKey, forge.md.sha256.create()); missing.extensions = certificate().extensions;
  assert.throws(() => api.validateSelfSignedCertificate(missing, pair), /not present/);
});
test('nested DigestAlgorithm fixture is rejected by Forge and all native surfaces', () => {
  const nestedSignature = require('./fixtures/signing/nested-digest.cjs');
  const data = Buffer.from('manifest');
  const signature = nestedSignature(pair.privateKey, data);
  assert.throws(() => pair.publicKey.verify(crypto.createHash('sha256').update(data).digest().toString('binary'), signature), /ASN\.1 object does not contain a valid/);
  const privateKey = { ...pair.privateKey, sign: () => signature };
  assert.throws(() => api.signBufferRSASHA256AndVerify(privateKey, certificate(), data), /not valid/);
  const cert = certificate(); cert.signature = nestedSignature(pair.privateKey, Buffer.from(forge.asn1.toDer(cert.tbsCertificate).getBytes(), 'binary'));
  assert.throws(() => cert.verify(cert), /ASN\.1 object does not contain a valid/);
  assert.throws(() => api.validateSelfSignedCertificate(cert, pair), /signature not valid/);
  const csr = api.generateCSR(pair, 'csr'); csr.signature = nestedSignature(pair.privateKey, Buffer.from(forge.asn1.toDer(csr.certificationRequestInfo).getBytes(), 'binary'));
  assert.throws(() => csr.verify(), /ASN\.1 object does not contain a valid/);
  assert.throws(() => issue(csr), /CSR not self-signed/);
});
test('malformed RSA signature parameters are rejected before native verification', () => {
  for (const kind of ['certificate', 'csr']) {
    const original = kind === 'certificate' ? forge.pki.certificateToAsn1(certificate()) : forge.pki.certificationRequestToAsn1(api.generateCSR(pair, 'csr'));
    original.value[1].value.push(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''));
    const encoded = forge.pem.encode({ type: kind === 'certificate' ? 'CERTIFICATE' : 'CERTIFICATE REQUEST', body: forge.asn1.toDer(original).getBytes() });
    assert.throws(() => {
      if (kind === 'certificate') api.validateSelfSignedCertificate(api.convertCertificatePEMToCertificate(encoded), pair);
      else issue(api.convertCSRPEMToCSR(encoded));
    }, /Invalid signature AlgorithmIdentifier|ASN.1|Too few bytes/);
  }
});
