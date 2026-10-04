#!/usr/bin/env python3
"""Build deterministic local packages and verify upstream/archive provenance offline."""
import argparse
import base64
import difflib
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parent
PACKAGES = [
    ('braces', 'braces', '3.0.3', 'sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==', 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm', '3.0.4+sixnations.1'),
    ('decode-uri-component', 'decode-uri-component', '0.5.0', 'sha512-1BiQVoK8C9gUbQU6NzAtO/tkz2qOFpEObMWpcFvhx4fYnj4Oc5yzaJN/LD36ihkVUdXyh5ZekzX+yM+ty/SrPg==', 'https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0'),
    ('expo-code-signing-certificates', '@expo/code-signing-certificates', '0.0.6', 'sha512-iNe0puxwBNEcuua9gmTGzq+SuMDa0iATai1FlFTMHJ/vUmKvN/V//drXoLJkVb5i5H3iE/n/qIJxyoBnXouD0w==', 'https://github.com/advisories/GHSA-86w9-cpqp-85rv'),
    ('node-forge', 'node-forge', '1.4.0', 'sha512-LarFH0+6VfriEhqMMcLX2F7SwSXeWwnEAJEsYm5QKWchiVYVvJyV9v7UDvUv+w5HO23ZpQTXDv/GxdDdMyOuoQ==', 'https://github.com/advisories/GHSA-86w9-cpqp-85rv', '1.4.1+sixnations.1'),
]

def integrity(data):
    return 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()

def archive(files):
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', filename='', mtime=0, compresslevel=9) as gz:
        with tarfile.open(fileobj=gz, mode='w', format=tarfile.GNU_FORMAT) as tar:
            for name, data in sorted(files.items()):
                entry = tarfile.TarInfo('package/' + name)
                entry.size = len(data)
                entry.mode = 0o644
                tar.addfile(entry, io.BytesIO(data))
    return buffer.getvalue()

def store(path, data, check):
    if check:
        if not path.is_file() or path.read_bytes() != data:
            raise SystemExit(f'Vendor content drift: {path.relative_to(ROOT)}; rebuild and review')
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

def text_lines(data):
    try:
        return data.decode().splitlines(keepends=True)
    except UnicodeDecodeError:
        return []

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read-only: verify archives, patches, and hashes')
    args = parser.parse_args()
    records = []
    for entry in PACKAGES:
        directory, name, upstream_version, expected_integrity, reference = entry[:5]
        local_version = entry[5] if len(entry) == 6 else upstream_version + '+sixnations.1'
        upstream_path = ROOT / 'upstream' / f'{directory}-{upstream_version}.tgz'
        upstream_bytes = upstream_path.read_bytes()
        if integrity(upstream_bytes) != expected_integrity:
            raise SystemExit(f'Upstream integrity mismatch: {name}')
        with tarfile.open(fileobj=io.BytesIO(upstream_bytes), mode='r:gz') as tar:
            original = {member.name.removeprefix('package/'): tar.extractfile(member).read()
                        for member in tar.getmembers() if member.isfile()}
        source = ROOT / directory
        files = ({str(path.relative_to(source)): path.read_bytes() for path in source.rglob('*') if path.is_file()}
                 if source.is_dir() else original.copy())
        if name == 'node-forge':
            package = json.loads(files['package.json'])
            package['version'] = local_version
            package.pop('scripts', None)
            package.pop('devDependencies', None)
            files['package.json'] = (json.dumps(package, indent=2) + '\n').encode()
            rsa = files['lib/rsa.js'].decode()
            needle = """          var obj = asn1.fromDer(d, {\n            parseAllBytes: options._parseAllDigestBytes\n          });\n"""
            replacement = needle + """\n          // AlgorithmIdentifier is exactly OID plus optional NULL. Reject\n          // nested or extra elements before accepting the digest.\n          var algorithmIdentifier = obj.value && obj.value[0];\n          if(!algorithmIdentifier || !Array.isArray(algorithmIdentifier.value) ||\n            algorithmIdentifier.value.length < 1 || algorithmIdentifier.value.length > 2 ||\n            algorithmIdentifier.value[0].type !== asn1.Type.OID ||\n            (algorithmIdentifier.value[1] &&\n              (algorithmIdentifier.value[1].type !== asn1.Type.NULL ||\n               algorithmIdentifier.value[1].constructed))) {\n            throw new Error(\n              'ASN.1 object does not contain a valid RSASSA-PKCS1-v1_5 ' +\n              'DigestInfo value.');\n          }\n"""
            if needle not in rsa:
                raise SystemExit('Unable to locate node-forge RSA verification code')
            files['lib/rsa.js'] = rsa.replace(needle, replacement).encode()
        package = json.loads(files['package.json'])
        version = local_version
        if package['name'] != name or package['version'] != version:
            raise SystemExit(f'Unexpected package identity: {name}')
        if package.get('scripts') or package.get('devDependencies'):
            raise SystemExit(f'Local runtime package must not contain build/install scripts or dev dependencies: {name}')
        patch = ''.join(''.join(difflib.unified_diff(
            text_lines(original.get(path, b'')),
            text_lines(files.get(path, b'')),
            fromfile='upstream/' + path, tofile='local/' + path))
            for path in sorted(set(original) | set(files)))
        packaged = archive(files)
        archive_name = f'packages/{directory}-{version}.tgz'
        patch_name = f'patches/{directory}.patch'
        store(ROOT / archive_name, packaged, args.check)
        store(ROOT / patch_name, patch.encode(), args.check)
        records.append({
            'name': name, 'upstreamVersion': upstream_version, 'localVersion': version,
            'sourceDirectory': directory, 'upstreamArchive': str(upstream_path.relative_to(ROOT)),
            'upstreamIntegrity': expected_integrity, 'reference': reference,
            'archive': archive_name, 'integrity': integrity(packaged), 'patch': patch_name,
            'patchSha256': hashlib.sha256(patch.encode()).hexdigest(),
            'files': {path: hashlib.sha256(data).hexdigest() for path, data in sorted(files.items())},
        })
    store(ROOT / 'provenance.json', (json.dumps(records, indent=2) + '\n').encode(), args.check)
    print('Vendor archives, upstream integrity, patches and source hashes verified' if args.check else 'Vendor packages and provenance rebuilt')

if __name__ == '__main__':
    main()
