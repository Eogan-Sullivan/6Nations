'use strict';
// Regression construction for GHSA-86w9-cpqp-85rv: append an extra nested
// DigestAlgorithm element. The test owns the private key so it can construct
// the malformed encoded block directly, without implementing a forgery attack.
const forge = require('node-forge');
const crypto = require('node:crypto');
module.exports = function nestedDigestSignature(privateKey, data) {
  const { asn1 } = forge;
  const digest = crypto.createHash('sha256').update(data).digest();
  const algorithm = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(forge.pki.oids.sha256).getBytes()),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, 'extra nested element'),
  ]);
  const info = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [algorithm, asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digest.toString('binary'))]);
  const bytes = Buffer.from(asn1.toDer(info).getBytes(), 'binary');
  const size = Math.ceil(privateKey.n.bitLength() / 8);
  const block = Buffer.concat([Buffer.from([0, 1]), Buffer.alloc(size - bytes.length - 3, 255), Buffer.from([0]), bytes]);
  return crypto.privateEncrypt({ key: forge.pki.privateKeyToPem(privateKey), padding: crypto.constants.RSA_NO_PADDING }, block).toString('binary');
};
