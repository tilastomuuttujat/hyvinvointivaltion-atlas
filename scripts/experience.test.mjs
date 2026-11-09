import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){const deadline=Date.now()+10000;while(!predicate()){if(Date.now()>deadline)throw new Error(`Timed out: ${label}`);await pause(40)}}
test('built experience preserves the sphere and follows the evidence all the way to its source',{timeout:60000},async()=>{
 const snapshot=JSON.parse(await readFile(new URL('../public/data/atlas.json',import.meta.url),'utf8'));
 const directory=new URL('../dist-pages/assets/',import.meta.url);
 const entry=(await readdir(directory)).find(name=>/^index-.*\.js$/.test(name));
 assert.ok(entry,'Run build:pages before test:experience');
 const errors=[],requests=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.org/hyvinvointivaltion-atlas/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
 const w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
 w.fetch=async url=>{requests.push(String(url));return {ok:true,json:async()=>snapshot}};
 try {
  w.eval(await readFile(new URL(entry,directory),'utf8'));
  await until(()=>w.document.querySelector('.atlas-experience'),'experience mount');
  const scope=w.document.querySelector('.atlas-experience'),sphere=scope.querySelector('[data-testid="atlas-sphere"]'),svg=sphere.querySelector('svg[data-zoom]');
  svg.getBoundingClientRect=()=>({left:0,top:0,width:680,height:600,right:680,bottom:600});
  const click=element=>{assert.ok(element,'Missing clickable target');element.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
  const button=text=>[...scope.querySelectorAll('button')].find(b=>b.textContent===text);
  const choose=label=>click([...scope.querySelectorAll('.investigation-choices button')].find(b=>b.textContent===label));
  const expected=snapshot.treatments.filter(t=>t.conclusionId===1&&t.periodId==='p1'&&t.reviewStatus!=='rejected').length;
  await until(()=>scope.querySelectorAll('.article-evidence-item').length===expected,'all article results');
  assert.ok(expected>1);assert.equal(scope.querySelector('.article-evidence summary').textContent,`Artikkelien perustelut (${expected})`);
  click(button('Aloita lähteistetty esimerkkipolku'));
  await until(()=>svg.dataset.reasoningDepth==='2'&&button('Mihin tämä vaikuttaa?'),'concept layer');
  const label=snapshot.evidence.concepts.find(c=>c.id==='sustained_return_to_work').label;
  choose(label);await until(()=>svg.dataset.reasoningDepth==='3','explanation layer');
  choose('Tukee: Tutkimustulos');await until(()=>svg.dataset.reasoningDepth==='4','observation layer');
  assert.ok(scope.textContent.includes('8,0 prosenttiyksikköä'));
  const observation=snapshot.evidence.observations.find(o=>o.id.includes('3664'));
  choose(observation.title);await until(()=>svg.dataset.reasoningDepth==='5','source layer');
  assert.ok([...scope.querySelectorAll('.investigation-choices a')].some(a=>a.href===observation.sourceUrl));
  assert.equal(scope.querySelector('[aria-label="Sijainti selityspolulla"]').querySelectorAll('button').length,6);
  const year=scope.querySelector('input[type="range"]').value;
  svg.dispatchEvent(new w.WheelEvent('wheel',{deltaY:800,deltaMode:0,clientX:500,clientY:200,bubbles:true,cancelable:true}));
  await until(()=>svg.dataset.reasoningDepth==='0','zoom out');
  assert.equal(scope.querySelector('[aria-label="Sijainti selityspolulla"]').querySelectorAll('button').length,1);
  svg.dispatchEvent(new w.WheelEvent('wheel',{deltaY:-800,deltaMode:0,clientX:500,clientY:200,bubbles:true,cancelable:true}));
  await until(()=>svg.dataset.reasoningDepth==='5','restore source context');
  assert.equal(scope.querySelector('[aria-label="Sijainti selityspolulla"]').querySelectorAll('button').length,6);
  assert.equal(scope.querySelector('input[type="range"]').value,year);
  assert.equal(scope.querySelector('[data-testid="atlas-sphere"]'),sphere);assert.equal(sphere.querySelector('svg[data-zoom]'),svg);
  const range=scope.querySelector('input[type="range"]');Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(range,'2050');range.dispatchEvent(new w.Event('input',{bubbles:true}));range.dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>scope.textContent.includes('Lähde liittyy valitun aikarajauksen ulkopuoliseen havaintoon.'),'temporal warning');
  assert.deepEqual(errors,[]);assert.equal(requests.length,1);assert.ok(requests[0].endsWith('/data/atlas.json'));
 } finally {dom.window.close()}
});

test('reader can select conclusions, follow their comparison and inspect its basis on the same globe',{timeout:60000},async()=>{
 const snapshot=JSON.parse(await readFile(new URL('../public/data/atlas.json',import.meta.url),'utf8'));
 const directory=new URL('../dist-pages/assets/',import.meta.url),entry=(await readdir(directory)).find(name=>/^index-.*\.js$/.test(name));
 assert.ok(entry,'Run build:pages before test:experience');
 const errors=[],requests=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.org/hyvinvointivaltion-atlas/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console}),w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
 w.fetch=async url=>{requests.push(String(url));return {ok:true,json:async()=>snapshot}};
 try{
  w.eval(await readFile(new URL(entry,directory),'utf8'));await until(()=>w.document.querySelector('.atlas-experience'),'experience mount');
  const scope=w.document.querySelector('.atlas-experience'),sphere=scope.querySelector('[data-testid="atlas-sphere"]'),svg=sphere.querySelector('svg[data-zoom]');
  const button=text=>[...scope.querySelectorAll('button')].find(b=>b.textContent===text);
  const click=e=>{assert.ok(e,'Missing button');e.click()};
  click(button('Valitse vertailtavat päätelmät'));await until(()=>scope.querySelector('.comparison-picker'),'picker');
  assert.equal(button('Näytä yhteydet ja erot').disabled,true);
  for(const [i,id] of [1,2,25].entries()){
   const input=scope.querySelector(`input[aria-label^="Päätelmä ${id}:"]`);assert.ok(input);input.click();
   await until(()=>scope.querySelector('.comparison-picked').textContent.startsWith(`${i+1} / 3`),'checkbox selection');
  }
  assert.equal(scope.querySelector('input[aria-label^="Päätelmä 3:"]').disabled,true);
  const search=scope.querySelector('input[type="search"]');Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(search,'ei-vastaavaa-aihetta-xyz');search.dispatchEvent(new w.Event('input',{bubbles:true}));
  await until(()=>scope.querySelector('.comparison-catalog').children.length===0,'empty search');assert.ok(scope.querySelector('.comparison-picked').textContent.startsWith('3 / 3'));
  click(button('Näytä yhteydet ja erot'));await until(()=>scope.querySelector('.comparison-narrative'),'comparison narrative');
  assert.equal(scope.querySelectorAll('.comparison-legend>span').length,3);
  assert.equal(button('Toista').disabled,true);
  assert.ok(scope.textContent.includes('Yhteinen tausta on asiayhteys'));
  const series=new Set([...svg.querySelectorAll('[data-sphere-point]')].map(n=>Number(n.getAttribute('data-sphere-point').split(':')[0])));assert.deepEqual([...series].sort((a,b)=>a-b),[1,2,25]);
  assert.ok(svg.querySelectorAll('[data-comparison-series]').length>0);
  for(const path of svg.querySelectorAll('[data-comparison-link] path'))assert.equal(path.getAttribute('marker-end'),null);
  click(button('Jatka kertomusta →'));await until(()=>scope.querySelector('.comparison-table-scroll table'),'difference table');
  assert.equal(scope.querySelectorAll('.comparison-table-scroll tbody tr').length,3);
  click(button('Jatka kertomusta →'));await until(()=>scope.textContent.includes('Näille päätelmille ei löydy nykyistä kirjattua yhteisvaikutusketjua.'),'honest missing interaction');
  click(button('Mihin tämä perustuu?'));await until(()=>scope.querySelectorAll('.comparison-basis details').length>0,'article basis');
  assert.ok([...scope.querySelectorAll('.comparison-source a')].some(a=>a.href==='https://www.sjweh.fi/article/3664'));
  const period=scope.querySelector('select[aria-label="Vertailun aikaväli"]');period.value='p6';period.dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>scope.querySelector('.comparison-narrative .experience-eyebrow').textContent.includes('2010'),'comparison period');
  assert.equal(scope.querySelectorAll('.comparison-legend>span').length,3);
  assert.ok([...svg.querySelectorAll('[data-sphere-point]')].every(n=>n.getAttribute('data-sphere-point').split(':')[1]==='p6'));
  assert.equal(scope.querySelector('[data-testid="atlas-sphere"]'),sphere);assert.equal(sphere.querySelector('svg[data-zoom]'),svg);
  click(button('Muuta valintoja'));await until(()=>scope.querySelector('.comparison-picker'),'edit selection');
  scope.querySelector('input[aria-label^="Päätelmä 2:"]').click();await until(()=>scope.querySelector('.comparison-picked').textContent.startsWith('2 / 3'),'remove one selection');
  assert.equal(scope.querySelectorAll('.comparison-legend>span').length,3);
  click(button('Näytä yhteydet ja erot'));await until(()=>scope.querySelectorAll('.comparison-legend>span').length===2,'apply new comparison');
  assert.equal(scope.querySelector('select[aria-label="Vertailun aikaväli"]').value,'p6');
  svg.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await until(()=>!scope.querySelector('.comparison-narrative'),'close comparison by keyboard');click(button('Palaa vertailuun'));await until(()=>scope.querySelectorAll('.comparison-legend>span').length===2,'resume comparison');
  assert.deepEqual(errors,[]);assert.equal(requests.length,1);
 }finally{dom.window.close()}
});

test('concept maps drill down to sources, retain context across views and follow recorded routes',{timeout:60000},async()=>{
 const snapshot=JSON.parse(await readFile(new URL('../public/data/atlas.json',import.meta.url),'utf8'));
 const directory=new URL('../dist-pages/assets/',import.meta.url),entry=(await readdir(directory)).find(n=>/^index-.*\.js$/.test(n));
 const errors=[],requests=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.org/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>snapshot}};
 const button=(scope,text)=>[...scope.querySelectorAll('button')].find(b=>b.textContent===text);
 const click=e=>{assert.ok(e,'Missing target');e.click()};
 try{
  w.eval(await readFile(new URL(entry,directory),'utf8'));await until(()=>w.document.querySelector('.view-switch'),'menu');
  const menu=w.document.querySelector('.view-switch'),sphere=w.document.querySelector('[data-testid="atlas-sphere"]');
  click(button(menu,'⊹ Akselikenttä'));await until(()=>w.document.querySelector('[data-layout="field"]'),'map');
  const map=w.document.querySelector('[data-layout="field"]'),svg=map.querySelector('svg[data-depth]');
  assert.equal(map.querySelectorAll('[data-concept-id]').length,13);
  const node=map.querySelector('[data-concept-id="sustained_return_to_work"]');node.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await until(()=>svg.dataset.depth==='2','concept zoom');
  click([...map.querySelectorAll('.concept-map-list button')].find(b=>b.textContent.startsWith('Tutkimustulos')));
  await until(()=>map.querySelector('.concept-map-evidence'),'finding');assert.ok(map.textContent.includes('8,0 prosenttiyksikköä'));
  click([...map.querySelectorAll('.concept-map-evidence button')].find(b=>b.textContent.startsWith('Lähde:')));
  await until(()=>map.querySelector('.concept-map-source a'),'source');assert.equal(map.querySelector('.concept-map-source a').href,'https://www.sjweh.fi/article/3664');
  const zoom=svg.dataset.zoom;
  click(button(menu,'◎ Säteittäinen'));await until(()=>button(menu,'◎ Säteittäinen').getAttribute('aria-current')==='true','radial');
  click(button(menu,'⊹ Akselikenttä'));await pause(80);assert.equal(map.querySelector('svg'),svg);assert.equal(svg.dataset.zoom,zoom);assert.ok(map.querySelector('.concept-map-source a'));
  const period=map.querySelector('select[aria-label="Käsitekartan aikakausi"]');period.value='p1';period.dispatchEvent(new w.Event('change',{bubbles:true}));await until(()=>map.querySelector('.concept-map-caution'),'time warning');assert.equal(button(map,'Aloita reitti').disabled,true);
  period.value='';period.dispatchEvent(new w.Event('change',{bubbles:true}));await until(()=>!button(map,'Aloita reitti').disabled,'restore route');click(button(map,'Aloita reitti'));await until(()=>map.querySelector('.concept-map-path-steps [aria-current="step"]')?.textContent.startsWith('1.'),'start');
  click(button(map,'Seuraava vaihe →'));await until(()=>map.querySelector('.concept-map-path-steps [aria-current="step"]')?.textContent.startsWith('2.'),'next');assert.equal(button(map,'Toista reitti').disabled,true);
  click(button(menu,'⌁ Reittikartta'));await until(()=>w.document.querySelector('[data-layout="routes"]'),'routes');const routes=w.document.querySelector('[data-layout="routes"]');assert.equal(routes.querySelectorAll('[data-mechanism-id]').length,2);
  click(button(menu,'◐ Pallo'));await pause(80);assert.equal(w.document.querySelector('[data-testid="atlas-sphere"]'),sphere);assert.equal(requests.length,1);assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});
