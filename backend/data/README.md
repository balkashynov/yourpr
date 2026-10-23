# Official source evidence

`raw/` contains immutable IRCC responses named by their SHA-256 digest. `manifest.json` records their official URL, retrieval time and parser version. `snapshot.json` contains normalized public observations and computed validation results. These files contain no user data.

Source: https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json

Government source material is separately attributed and is not relicensed by the project's MIT license. Normalized figures should retain their source and retrieval metadata when reused. The project is independent of IRCC.

Generated `yourpr.sqlite` and runtime refresh state are gitignored. `make reproduce` rebuilds the analytical database from the pinned raw fixture. See the top-level source audit for missing-data and integrity decisions.
