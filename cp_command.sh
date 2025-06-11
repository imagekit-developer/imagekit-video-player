  find . -mindepth 1 -name '.*' -prune \
  -o \(  -name examples  -o -name packages -o -name dist -o -path ./packages/javascript/modules -o -name node_modules -o -name yarn.lock \) -prune \
  -o -type f \
  ! -iname '*.jpg' \
  ! -iname '*.jpeg' \
  ! -iname '*.png' \
  ! -iname '*.gif' \
  ! -iname '*.bmp' \
  ! -iname '*.svg' \
  ! -iname '*.webp' \
  ! -iname 'sample.json' \
  ! -iname 'sample.transcript' \
  ! -iname '*.scss' \
  ! -iname '*.css' \
  ! -iname '*.html' \
  -print0 | xargs -0r tail -n +1 | pbcopy

    find . -mindepth 1 -name '.*' -prune \
  -o -type f \
  ! -iname '*.jpg' \
  ! -iname '*.jpeg' \
  ! -iname '*.png' \
  ! -iname '*.gif' \
  ! -iname '*.bmp' \
  ! -iname '*.svg' \
  ! -iname '*.webp' \
  ! -iname 'sample.json' \
  ! -iname '*.html' \
  -print0 | xargs -0r tail -n +1 | pbcopy


   find . -mindepth 1 -name '.*' -prune \
  -o \(  -name examples  -o -name packages -o -name dist -o -path ./packages/javascript/modules -o -name node_modules -o -name yarn.lock \) -prune \
  -o -type f \
  ! -iname '*.jpg' \
  ! -iname '*.jpeg' \
  ! -iname '*.png' \
  ! -iname '*.gif' \
  ! -iname '*.bmp' \
  ! -iname '*.svg' \
  ! -iname '*.webp' \
  ! -iname 'sample.json' \
  ! -iname 'sample.transcript' \
  ! -iname '*.scss' \
  ! -iname '*.css' \
  ! -iname 'package-lock.json' \
  -print0 | xargs -0r tail -n +1 | pbcopy