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

### Vaihtoehtoinen Atlas-pallo

Vasemman reunan **Näkymä → Atlas-pallo** näyttää saman aineiston pyöritettävänä kolmiulotteisena projektiona. Pituusaste perustuu aikakauden keskivuoteen (1850–2050), leveysaste järjestää päätelmät, kerros erottaa taustoittavat/suorat/vastanäyttökytkennät ja pisteen koko kertoo kytkentöjen määrän. Nämä eivät ole poikkeamien tai yhteiskunnallisten vaikutusten mittareita.

Klikkaus valitsee päätelmän ja aikakauden sekä avaa niiden käsittelykortit. Saman päätelmän pisteet eri aikakausina korostuvat; muut himmenevät tai ne voi piilottaa. Katkoviivat yhdistävät viereisten aikakausien saman päätelmän pisteitä vain silloin, kun molemmissa on aineistoa. Ne eivät väitä kausaalista vaikutusta. Valinta säilyy näkymää vaihdettaessa.

Palloa voi kiertää vetämällä tai nuolinäppäimillä. Zoomia säädetään liukusäätimellä tai +/−-näppäimillä. Esc tai **Näytä kokonaisuus** poistaa valinnan. Pisteet ovat valittavissa myös tekstivalikosta. Teemojen ja havainto–käsitekytkentöjen tuominen tähän projektioon edellyttää niiden lisäämistä yhteiseen JSON-vientiin; nykyinen pallonäkymä käyttää päätelmäaineistoa.

### Yhteyksien perusteet ja tarkistustilat

Päätelmien välinen kaari tarvitsee samalla aikakaudella vähintään yhden yhteisen artikkelin tai täsmälleen vastaavan kirjatun avainkäsitteen. Pelkkä esiintyminen samalla aikakaudella ei riitä. Käsitesanoista verrataan Unicode-normalisoitua, reunaväleistä siivottua ja pienaakkostettua tekstiä; synonyymejä ei päätellä eikä vapaita käsitesanoja esitetä vielä yhtenäistettyinä käsite-ID:inä. Yhteinen artikkeli ei välttämättä tarkoita yhteistä havaintoa tai tekstinäytettä. Kaari on asiayhteys, ei kausaalinen vaikutuspolku.

Yhteyskorteissa näytetään peruste (artikkelinumerot ja/tai käsitesanat), ja niistä voi avata toisen päätelmän saman aikakauden käsittelyn. Kuvaajassa näytetään enintään 14 yhteyttä, mutta kaikki perusteet voi lukea luettelosta. Aikajana ei yhdistä aineistoaukkojen yli. Puuttuvat jaksot luetellaan erikseen ja ne riippuvat nykyisestä lajien ja kerrosten rajauksesta.

Pallon ja käsittelypaneelin aikakausivalinta on yhteinen. Artikkelikorteissa näkyvät tarkistustila, rajaukset ja kirjatut käsitteet. Sivun alareunassa näkyvät JSON-viennin ajankohta ja tarkistusperiaate. Sekä palvelinversio että Pages-vienti käyttävät samaa nykyisiin revisioihin rajattua SQL-vientiä.

### Havaintoaineisto

Avainkäsitteittäin avattava havaintoluettelo käyttää samaa julkista JSONia kuin pallo. `evidence` sisältää määritellyn sanaston, tilastohavainnot, tutkimustulokset ja niiden kytkennät. Se on erillinen pallon vapaamuotoisista artikkelikäsitteistä. Pallon aikakausisuodatin ei rajaa luetteloa.

Vienti jättää pois julkaisukiellossa olevat ja julkaisemattomiksi merkityt tilastohavainnot sekä hylätyt kytkennät. Tutkimusten epätarkat ajoitukset ja kuukausitietojen viiteajat säilyvät. Artikkeliviitteissä näkyvät hyväksyntä ja revisioiden ajantasaisuus; viitettä ei tulkita päätelmän näytöksi. Lähdearvojen peritty tarkistustila säilyy, eikä vienti tee uutta lähdevarmennusta. Tyhjät käsitteet näkyvät havaintoaukkoina.

Nykyinen havaintokerros: 13 käsitettä, 284 havaintoa, 519 kytkentää; 30 havaintoa pidätetty. Päivitä koko snapshot olemassa olevalla `export:atlas`-komennolla tai Pages-työnkulun refresh-valinnalla.


### Selitysrakenne: lähteestä väitteeseen

`atlas_reasoning` täydentää olemassa olevaa havaintokerrosta. Rakenne erottaa:

- klusterit ja monijäseniset avainkäsitteet;
- yhtenäisen lähderekisterin ja havaintokohtaisen lähdekohdan;
- täsmälliset väitteet, hypoteesit, synteesit, arviointiperiaatteet ja skenaariot;
- havainto → tukee / haastaa / rajaa / taustoittaa → väite -kytkennät;
- väitteiden väliset perustelut ja oletukset;
- käsitteiden väliset mekanismit, niiden ehdot ja näytön lajin;
- erikseen perustellut yhteydet aiempiin päätelmiin;
- järjestetyt, käsitteiden kautta etenevät selityspolut.

Lähdevarmennus, näytön soveltuvuus ja toimituksellinen hyväksyntä ovat erillisiä. Kaikki pilotin uudet tulkinnat ovat `needs_review`; alkuperäisiä hyväksyntöjä ei muuteta. Pilotin yhteys päätelmään 25 on taustayhteys. Kustannussäästö jää hypoteesiksi, jota työhönpaluututkimus ei yksin osoita.

Neoniin on viety neljä klusteria, 16 jäsenyyttä, 314 havaintojen lähdeviitettä, kolme väitettä, kaksi evidenssisuhdetta, kaksi mekanismia ja yksi kolmivaiheinen pilottipolku. Julkisessa snapshotissa on edelleen 284 havaintoa; 30 pidätetyn havainnon lähdeviitteitä ei viedä. Julkinen lähderekisteri sisältää vain näkyvien havaintojen lähteet. Tilastolähteiden nimet ovat aluksi perittyjä URL-tunnisteita; niitä ei ole bibliografisesti täydennetty eikä lähdearvoja tarkistettu uudelleen.

`evidence.reasoning` on valinnainen, versionumeroitu laajennus. Vanha JSON pysyy luettavana. Havaintonäkymässä voi rajata klusterin, seurata pilotin vaiheita ja avata väitteiden perustelut. Pallon automaattista animaatiota tämä muutos ei vielä lisää; polkurakenne tarjoaa sille aineiston. Sanastoa ei yhdistetä automaattisesti pallon vapaatekstikäsitteisiin.

#### Hallittu käyttöönotto

1. Testaa migraatio tuotannosta luodulla Neon-haaralla.
2. Aja `NEON_DATABASE_URL=… npm run migrate:reasoning` ensin testihaaralle ja sitten kohdehaaraan. Yhteys tarvitaan vain palvelimessa. Migraatio on lisäävä ja transaktionaalinen, tarkistussummat estävät jo ajetun migraation hiljaisen muuttamisen.
3. Tarkista `database/verify-reasoning.sql`. `database/check-reasoning-constraints.sql` on tarkoitettu vain testihaaraan.
4. Aja `npm run export:atlas`, `npm run test:pages` ja `npm run build:pages`.

Sisältömuutokset kasvattavat lähteen tai väitteen revisiota automaattisesti. Kytkentöihin tallennetaan perustana oleva revisio ja havainnon lähdetietueen tiiviste. Vanhentuneet, hylätyt ja julkaisukiellossa olevaan havaintoon liittyvät evidenssikytkennät suodatetaan viennistä. Muuttuneisiin väitteisiin perustuvaa polkua ei viedä osittaisena. Vanha artikkelikytkentä ei muutu hyväksytyksi näytöksi.

`export-reasoning.sql` on viennin kanoninen alikysely, joka on upotettu `export-atlas.sql`:ään, jotta palvelin ja Pages käyttävät samaa yhden kyselyn snapshotia. Testi tarkistaa niiden yhtäpitävyyden. Uusi sisältö ja siihen liittyvät kytkennät lisätään uutena siemen-/migraatioversiona; jo ajettuja tiedostoja ei muuteta.
