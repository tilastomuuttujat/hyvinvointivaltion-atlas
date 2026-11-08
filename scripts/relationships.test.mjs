import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedConnections, timelineSegments } from '../src/lib/atlas.relationships.ts';
const row = (c,p,articleNo,concepts=[],reviewStatus='needs_review') => ({c,p,articleNo,concepts,reviewStatus,relation:'direct'});
test('same era alone is not a relationship',()=>{
 assert.deepEqual(relatedConnections([row(1,'p1',1),row(2,'p1',2)],1),[]);
});
test('shared articles and exact normalized concept names identify their basis; deduplicate',()=>{
 const result=relatedConnections([row(1,'p1',1,[' Työkyky ']),row(2,'p1',1),row(2,'p1',2,['työkyky']),row(2,'p1',2,['TYÖKYKY']),row(3,'p2',1,['Työkyky']),row(4,'p1',1,[],'rejected')],1);
 assert.equal(result.length,1);assert.equal(result[0].c,2);assert.deepEqual(result[0].articles,[1]);assert.equal(result[0].concepts.length,1);
});
test('a concept match is not inferred from substrings',()=>{
 assert.deepEqual(relatedConnections([row(1,'p1',1,['työkyky']),row(2,'p1',2,['työkyvyn tuki'])],1),[]);
});
test('timeline preserves gaps, but connects adjacent populated eras',()=>{
 const t=[{id:'p1',hasData:true},{id:'p2',hasData:false},{id:'p3',hasData:true},{id:'p4',hasData:true}];
 assert.deepEqual(timelineSegments(t).map(([a,b])=>[a.id,b.id]),[['p3','p4']]);
});
