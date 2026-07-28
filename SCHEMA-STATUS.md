# Schema status

- **Corrected schemas verified**: all three vendored schemas are byte-identical to the canonical package-engine reference now merged to main (reviewed head `af49fd542e7190d1da72a6e0b9214036b59cbd7c`; package-engine merge `612b4f8c48efb63be7435df3d4473feba7b25abf`; package-config merge `a0366349915f151b6f6897cb682b7258f9fc1d79`); CI validates package and capability manifests against them.
- **Flat root supported**: the frozen runtime addendum explicitly supports `capabilities: ["."]`; root `oas.json` and the three canonical root skills are final.
- `TODO(engine-consumer-fixtures)`: run the released OAS 0.19.0 acquire → lock → activate → spawn probe when WS1 fixtures are available. This package has no executable surface and should not require `oas trust`.

No publication tag or catalog entry may be created while this item remains open.
