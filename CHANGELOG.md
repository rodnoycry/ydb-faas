# @rodnoycry/ydb-faas

## 1.0.1

### Patch Changes

- Fixed exports map: types-first ordering and added default condition for CJS consumers
- 03d26b1: Added example with Yandex Cloud Function and abstract service expecting DB instance to be available during the process lifetime

## 1.0.0

### Major Changes

- Created runWithYdb, getYdb and tryGetYdb helpers for handling lifetime withing handlers expecting driver to have lifetime of the process
