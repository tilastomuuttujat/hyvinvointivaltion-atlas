# Hyvinvointivaltion Atlas (1850–2050)

Suomen hyvinvointivaltion kehityskaarta, nykytilaan johtaneita syitä ja tulevaisuuden näkymiä avaava säteittäinen atlasvisualisointi.

Aineisto pohjautuu Neon-tietokannan `atlas_editing`-skeemaan (38 artikkelia, 53 päätelmää ja 7 aikakautta).

## Teknologia

- TanStack Start (SSR & server functions)
- React 19
- TypeScript
- Tailwind CSS v4
- Neon PostgreSQL connector gateway

## Kehitys

```sh
npm install
npm run dev
```


## GitHub Pages — staattinen lukuversio

1. Avaa **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Yhdistä Pages-muutokset `main`-haaraan. `Publish Atlas to GitHub Pages` rakentaa ja julkaisee sivun.
3. Osoite on `https://tilastomuuttujat.github.io/hyvinvointivaltion-atlas/`.

Pages-versio käyttää `public/data/atlas.json`-aineistovientiä. Sivun käyttö ei tee tietokantakyselyjä. Mukana toimitetaan nykyinen aineistovienti; ensimmäinen julkaisu ei tarvitse salaisuuksia. Alkuperäinen TanStack Start -palvelinversio säilyy (`npm run dev` / `npm run build`). Pages-versio käynnistyy `npm run dev:pages` ja rakentuu `npm run build:pages` → `dist-pages/`.

### Aineiston päivittäminen

Lisää **Settings → Secrets and variables → Actions** -kohtaan salaisuus `NEON_DATABASE_URL` (mieluiten vain lukuoikeuden sisältävän roolin PostgreSQL-yhteysmerkkijono). Älä lisää tunnusta VITE_-muuttujaan tai lähdekoodiin.

Valitse **Actions → Publish Atlas to GitHub Pages → Run workflow → main** ja ruksaa **Refresh the public JSON snapshot from Neon**. Vienti ja julkaisu tapahtuvat samassa ajossa; päivittynyt JSON on julkaisuartifaktissa, ei automaattisena Git-commitina. Tavallinen push käyttää repositorion talletettua snapshotia. Jos haluat säilyttää uuden viennin myös repositoriossa, suorita `npm run export:atlas` paikallisesti ympäristömuuttujalla `NEON_DATABASE_URL` ja commitoi vain `public/data/atlas.json`.

Vienti on vain luku -transaktio ja julkaisee vain SQL-tiedostossa luetellut julkisen lukuversion kentät. Mukana ovat myös toimitukselliset, tarkistusta odottavat kytkennät: tarkistustila näkyy kortissa. Hylätyt ja vanhoihin revisioihin perustuvat linkit jätetään pois. Kuvaajan kytkentämäärä ei ole vaikutuksen voimakkuus tai kausaalinen näyttö.

`npm run test:pages` tarkistaa JSONin viitteet, koontilukujen vastaavuuden yksittäisiin kytkentöihin ja tunnusten puuttumisen aineistosta. Peruspolku on `/hyvinvointivaltion-atlas/`; repositorion nimen vaihtuessa workflow käyttää uutta nimeä. Mukautetulle verkkotunnukselle käytä `PAGES_BASE_PATH=/`.
