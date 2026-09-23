# Third-party notices — JJ Workout Tool / Jarvis

## Exercise library data

Exercise names, categories, body parts, equipment, targets, secondary muscles, and
multilingual instructions come from
[**hasaneyldrm/exercises-dataset**](https://github.com/hasaneyldrm/exercises-dataset)
(MIT License). A slim JSON snapshot is vendored in
`packages/shared/src/data/exercisesLibrary.json` (Polish instructions preferred).

```
MIT License — Copyright (c) 2026 Hasan Emir Yıldırım
```

Full upstream license: https://github.com/hasaneyldrm/exercises-dataset/blob/main/LICENSE

## Exercise media (thumbnails & GIFs)

Media is **not** bundled in this repository. At runtime the app loads 180×180
thumbnails and animation GIFs from the jsDelivr CDN mirror of the upstream dataset
(commit pinned in `EXERCISE_MEDIA_COMMIT`).

That media is **© Gym visual — https://gymvisual.com/** and is redistributed by the
upstream dataset only with the rights holder's written permission. Cloning or using
this app does **not** grant a license to the media beyond Gym visual's terms:

- https://gymvisual.com/content/3-terms-and-conditions-of-use
- Upstream NOTICE: https://github.com/hasaneyldrm/exercises-dataset/blob/main/NOTICE.md

**Jarvis / JJ Workout Tool** uses CDN media for personal (kappa) builds with on-screen
attribution. For commercial distribution or App Store/Play, obtain your own rights
from Gym visual.

Every UI surface that shows exercise media must retain:
**© Gym visual — https://gymvisual.com/**
