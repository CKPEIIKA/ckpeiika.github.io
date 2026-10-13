import assert from 'node:assert/strict';
import test from 'node:test';
import catalog from '../demos/pde-lecture-6/src/catalog.js';
import { createLab } from '../demos/pde-lecture-6/src/labs.js';
import { paramsFromState, quantize } from '../demos/pde-gallery/gallery.js';

test('every gallery experiment and preset produces a finite board and measured rows',()=>{
  assert.equal(catalog.demos.length,14);
  for(const d of catalog.demos){
    const scenarios=[catalog.defaults(d),...(d.presets??[]).map(p=>({...catalog.defaults(d),...p.values}))];
    for(const p of scenarios){
      const model=createLab(d.id,p,'en');
      if(d.dynamic)for(let i=0;i<3&&!model.stop;i++)model.step();
      const view=model.render();
      assert.ok(view.ink.cmd.length>5,d.id);
      assert.ok(Array.isArray(view.stats)&&Array.isArray(view.rows),d.id);
      for(const c of view.ink.cmd){
        for(const key of ['x','y','x1','x2','y1','y2','w','h','min','max'])if(key in c)assert.ok(Number.isFinite(c[key]),`${d.id} ${key}`);
        for(const point of c.points??[])assert.ok(point.every(Number.isFinite),d.id);
        for(const value of c.data??[])assert.ok(Number.isFinite(value),d.id);
      }
    }
  }
});

test('all-method comparison keeps accepted profiles at the same physical time and excludes failed profiles',()=>{
  for(const caseId of ['sod','double-rarefaction']){
    const d=catalog.demos.find(d=>d.id==='comparison'),m=createLab(d.id,{...catalog.defaults(d),caseId,mode:'all',N:100},'en');
    for(let i=0;i<100&&!m.stop;i++)m.step();
    const v=m.render();
    for(const row of v.rows)for(const [k,value] of Object.entries(row))if(k.endsWith('_status')){
      const method=k.slice(0,-7);
      if(value==='valid')assert.ok(Math.abs(row[`${method}_time`]-row.time)<1e-12,caseId);
      else assert.equal(row[`${method}_rho`],'');
    }
  }
});

test('shared-gallery URL state restores only supported parameter values',()=>{
  const d=catalog.demos.find(d=>d.id==='sod'),defaults=catalog.defaults(d),p=paramsFromState(d,defaults,JSON.stringify({id:'sod',p:{methodA:'ausm-up',cfl:.35001,N:400,variable:'p',unknown:123}}));
  assert.equal(p.methodA,'ausm-up');assert.equal(p.N,400);assert.equal(p.variable,'p');assert.equal(p.cfl,.35);assert.equal(p.unknown,undefined);
  for(const d of catalog.demos)for(const c of d.controls)if(c.type==='range')assert.ok(Math.abs(quantize(c.value,c)-c.value)<1e-9,`${d.id}.${c.key} default lies on slider grid`);
});

test('shock comparison uses shared steps and measured ScalarField arrays',()=>{
  const d=catalog.demos.find(d=>d.id==='carbuncle'),m=createLab(d.id,{...catalog.defaults(d),nx:48},'en');
  for(let i=0;i<10;i++)m.step();
  const v=m.render(),fields=v.ink.cmd.filter(c=>c.type==='field');
  assert.equal(fields.length,2);assert.equal(fields[0].min,fields[1].min);assert.equal(fields[0].max,fields[1].max);
  for(const row of v.rows)assert.ok(Math.abs(row.roe_time-row.hlle_time)<1e-12);
});
