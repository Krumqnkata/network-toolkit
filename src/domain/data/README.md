# Bundled data

## IEEE OUI registry (`oui.ts`)

MAC address prefix → vendor, from the IEEE MA-L registry
(<https://standards-oui.ieee.org/oui/oui.csv>), fetched on 2026-11-16. Vendor
names are shortened and a few are mapped to the brand people know (for example
Routerboard.com → MikroTik). Blocks the IEEE split into MA-M/MA-S assignments
are left out. To refresh:

```sh
curl -L -o oui.csv https://standards-oui.ieee.org/oui/oui.csv
python scripts/generate-oui.py oui.csv
```

## Bluetooth assigned numbers

Generated from the Bluetooth SIG's public assigned numbers repository
(<https://bitbucket.org/bluetooth-SIG/public>, `assigned_numbers/`), fetched on
2026-11-16:

- `bluetoothCompanies.json` — `company_identifiers/company_identifiers.yaml`
  (manufacturer-specific data IDs → company name), 4073 entries.
- `bluetoothUuids.json` — `uuids/service_uuids.yaml` (`services`, standard GATT
  services) and `uuids/member_uuids.yaml` (`members`, 16-bit UUIDs registered by
  member companies). Keys are decimal numbers.

To refresh, download the three YAML files and convert each `value`/`uuid` +
`name` pair to the same JSON shape (keys in decimal).
