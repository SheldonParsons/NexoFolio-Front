# Pinned backend contracts

These bundles are copied byte-for-byte from the backend working tree, not rebuilt from handwritten frontend types.

- `documents/1.4.0`: interface list/detail and observations; expired temporary raw records are nullable and displayed explicitly as expired.
- `ingestion/2.2.0`: environment page/types and the synthetic capture fixture, with the full manifest bundle retained.
- `catalog-preview/1.4.0`: candidate and official directory views, versions and activation contracts; 14 manifest files pinned. Nullable source_task_id identifies legacy previews and source_run_id identifies maintenance runs. Restore retains explicit nullable targets.
- `maintenance/1.5.0`: rebuild tasks, snapshots, semantic annotations, publication/restore and checkpoint pages; 15 manifest files verified.
- `capture/1.2.0`: project-scoped single facts, observations and image assets; 15 manifest files verified. This frontend only reads evidence and does not control recording or upload.

Earlier pinned bundles are retained for history; active feature imports use the versions above.

Every file named in each manifest and `types.generated.ts` was checked against its SHA-256 before and after copying. The source manifests were compared again after implementation. `src/contracts` is excluded from Prettier to preserve these bytes.

Do not edit generated types or schemas. Review a new backend bundle explicitly, copy its manifest and files together, and update the imports. Runtime validation uses Ajv 2020-12 plus UUID/date-time formats; catalog preview additionally validates Schemars numeric formats. Initial document integration was not tested because the user prohibited testing at that time. The separately authorized catalog-preview change passed its focused frontend tests, typecheck and production build on 2026-09-15.
