# Bluetooth assigned numbers

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
