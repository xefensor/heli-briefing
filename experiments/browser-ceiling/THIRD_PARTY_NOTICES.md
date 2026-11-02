# Decoder and data notices

The authored experiment does not change the repository’s unresolved project-code licence. Downloaded decoder software keeps its own licences. Generated assets and binary dependencies are local research files, excluded from Git and the application build.

| Component | Source and attribution | Licence |
| --- | --- | --- |
| `@meri-imperiumi/eccodes-wasm@2.48.2` | [Henri Bergius / meri-imperiumi](https://github.com/meri-imperiumi/eccodes-wasm), wrapper and WebAssembly build. | [Apache 2.0 text supplied in the package](licenses/eccodes-wasm-Apache-2.0.txt). |
| ecCodes | [ECMWF](https://github.com/ecmwf/eccodes), bundled by the pinned package. | Apache 2.0. |
| libaec | [DKRZ](https://gitlab.dkrz.de/k202009/libaec), AEC decompression bundled by the pinned ecCodes package. | [BSD 2-Clause](https://gitlab.dkrz.de/k202009/libaec/-/blob/master/COPYING), as identified by that package. |
| Optional OpenJPEG components | [uclouvain](https://github.com/uclouvain/openjpeg), identified by the ecCodes package’s third-party notice; not used by this AEC field. | [BSD 2-Clause](https://github.com/uclouvain/openjpeg/blob/master/LICENSE). |
| `@foxglove/wasm-bz2@0.3.0` | [Foxglove](https://github.com/foxglove/wasm-bz2), bzip2 WebAssembly build. | [MIT text supplied in the package](licenses/wasm-bz2-MIT.txt). |
| bzip2 | [Julian Seward and bzip2 contributors](https://gitlab.com/bzip2/bzip2), underlying decompressor identified by Foxglove. | [bzip2 licence](https://gitlab.com/bzip2/bzip2/-/blob/master/LICENSE). |
| Forecast data | [DWD ICON-EU from dynamical.org / Source Cooperative](https://source.coop/dynamical/dwd-icon-grib). | CC BY 4.0 with source attribution; decoder licensing does not establish operational suitability. |

Setup makes two documented loader changes to the pinned software: it exposes the ecCodes high-level wrapper to a classic browser worker instead of CommonJS, and preserves a caller-supplied bzip2 `locateFile` function. Core decoder binaries are unchanged. SHA-512 integrity applies to the original registry archives, before these loader-only adaptations.

The generated `LICENSES.txt` includes this notice and the exact package licence texts. Reassess full dependency notices, browser support and distribution requirements before any production vendoring or broader binary redistribution.
