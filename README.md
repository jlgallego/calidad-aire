# Aire Madrid

Aplicación React + Vite para visualizar la calidad del aire de Madrid en dispositivos móviles.

## Datos y actualización

La fuente es el conjunto oficial [Calidad del aire. Datos en tiempo real](https://datos.madrid.es/dataset/212531-0-calidad-aire-tiempo-real), servido por la API de Ciudades Abiertas:

`https://ciudadesabiertas.madrid.es/dynamicAPI/API/query/calair_tiemporeal.json?pageSize=5000`

El workflow `.github/workflows/air-quality.yml` se ejecuta cada 20 minutos o manualmente. Descarga el JSON, publica `public/data/latest.json` y conserva una copia diaria en `public/data/history/AAAA-MM-DD.json`. Estos ficheros versionados son el almacenamiento histórico compatible con GitHub Pages: no hace falta una base de datos ni un servidor para servir la aplicación.

La app lee primero el snapshot de Pages y usa la API oficial como respaldo durante el desarrollo. Si una descarga falla, mantiene los datos de ejemplo incluidos en la interfaz.

## Desarrollo

```sh
npm install
npm run dev
```

## Importar una extracción de base de datos

La aplicación acepta una extracción TSV con las columnas `lect_nr_estacion`, `lect_nr_magnitud`, `lect_nr_lectura`, `lect_cd_verificada` y `lect_dt_timestamp`. Convierte las filas individuales a snapshots diarios y genera la serie de los tres últimos días:

```sh
npm run convert:tsv -- ./datos/lecturas.tsv
```

## Publicación

Configura GitHub Pages con GitHub Actions y usa el workflow de despliegue generado por Vite. El workflow de datos necesita permisos `Contents: Read and write` en `Settings > Actions > General`.

La licencia de los datos es [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.es). Los datos en tiempo real son automáticos y están pendientes de revisión y validación.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
