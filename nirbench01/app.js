/* NIRBENCH presentation: vanilla JavaScript; no client-side dependencies. */
(() => {
  'use strict';
  let data = window.NIRBENCH_DATA;
  if (!data) { document.getElementById('coverage').textContent = 'No data snapshot found. Run build_data.py first.'; return; }
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format = (x, digits = 3) => x == null || !Number.isFinite(x) ? '—' : x.toLocaleString('en-GB', {minimumFractionDigits:digits, maximumFractionDigits:digits});
  const mean = values => values.reduce((a,b) => a+b, 0) / values.length;
  const TABPFN_COLOR = '#8f3445';
  let tab = 'overview', datasetDomain = 'all', live = false, refreshing = false;
  let index, modelById, datasetById, currentRanking = [], commonDatasets = [];
  const dlModels = () => data.models.filter(m => !['Foundation','Classical'].includes(m.family));
  const scopedDatasets = () => data.datasets.filter(d => $('result-domain').value === 'all' || d.domain === $('result-domain').value);
  const rowFor = (dataset, model) => index.get(`${dataset}|${model}`);
  function reindex() {
    index = new Map(data.results.map(r => [`${r.dataset}|${r.model}`, r]));
    modelById = new Map(data.models.map(m => [m.id,m]));
    datasetById = new Map(data.datasets.map(d => [d.id,d]));
  }
  reindex();

  // Average ranks for ties. Every included model must have a result on every
  // included dataset; incomplete tasks never change a model's denominator.
  function calculateRanking(rows, modelIds, datasetIds) {
    const lookup = new Map(rows.map(r => [`${r.dataset}|${r.model}`,r]));
    const common = datasetIds.filter(d => modelIds.every(m => lookup.has(`${d}|${m}`)));
    if (!common.length || modelIds.length < 2) return {rows:[], common};
    const ranks = new Map(modelIds.map(m => [m,[]]));
    for (const d of common) {
      const sorted = modelIds.map(m => lookup.get(`${d}|${m}`)).sort((a,b) => a.rmse-b.rmse);
      for (let i=0;i<sorted.length;) {
        let j=i+1;
        while (j<sorted.length && sorted[j].rmse===sorted[i].rmse) j++;
        const rank=(i+1+j)/2;
        for(let k=i;k<j;k++) ranks.get(sorted[k].model).push(rank);
        i=j;
      }
    }
    const aggregate = modelIds.map(model => {
      const subset = common.map(d => lookup.get(`${d}|${model}`));
      const rank = mean(ranks.get(model));
      const times = subset.map(r => r.seconds).filter(v => v != null);
      return {model, score:100*(modelIds.length-rank)/(modelIds.length-1), rank,
              r2:mean(subset.map(r=>r.r2)), datasets:common.length,
              seconds:times.length === subset.length ? mean(times) : null};
    }).sort((a,b)=>b.score-a.score || a.model.localeCompare(b.model));
    return {rows:aggregate, common};
  }

  function renderStatus() {
    const counts = new Map(data.models.map(m => [m.id,data.results.filter(r=>r.model===m.id).length]));
    const n = counts.get('TabPFN35') || 0;
    $('coverage').innerHTML = `<span><b>${dlModels().reduce((sum,m)=>sum+counts.get(m.id),0)} / ${13*data.datasets.length}</b> DL results</span><span><b>${counts.get('PLSRegression')} / ${data.datasets.length}</b> PLS results</span><span class="${n<data.datasets.length?'partial':''}"><b>${n} / ${data.datasets.length}</b> TabPFN-3.5 results · ${n<data.datasets.length?'partial coverage':'complete coverage'}</span>`;
    $('updated').textContent = `Updated ${new Date(data.generatedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}`;
    $('connection').textContent = live ? 'Live local results · 30 s' : 'Saved snapshot';
    $('connection').classList.toggle('aqua',live);
    $('data-warning').hidden = !data.warnings.length;
    $('data-warning').textContent = `${data.warnings.length} source file(s) could not be read completely. Their results are omitted; refresh after the current write finishes. See the JSON snapshot for details.`;
  }

  function renderHero() {
    const h = data.hero; if (!h) return;
    const all = h.series.flat(), lo=Math.min(...all), hi=Math.max(...all);
    const x=i=>40+i/(h.x.length-1)*440, y=v=>185-(v-lo)/(hi-lo||1)*145;
    const colors=['#60e1dd','#56b5dd','#c2e594','#83d5ed','#b0c2e3','#6ec9aa','#e3b96b','#d88ba0'];
    const first=h.x[0],last=h.x[h.x.length-1];
    let svg=`<svg viewBox="0 0 515 240" role="img" aria-label="Eight actual training spectra from the wheat-flour protein dataset. Horizontal axis: wavelength columns ${escape(first)} to ${escape(last)}.">`;
    for(let i=0;i<4;i++){const yy=40+i*48;svg+=`<line x1="40" x2="480" y1="${yy}" y2="${yy}" stroke="#ffffff13"/>`;}
    for(let i=0;i<5;i++){const xx=40+i*110;svg+=`<line x1="${xx}" x2="${xx}" y1="30" y2="190" stroke="#ffffff0c"/>`;}
    h.series.forEach((s,i)=>{svg+=`<path d="${s.map((v,j)=>`${j?'L':'M'}${x(j).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="1.8" opacity=".85"/>`;});
    [0,Math.floor((h.x.length-1)/2),h.x.length-1].forEach(i=>{svg+=`<text x="${x(i)}" y="214" fill="#91acc0" font-size="10" text-anchor="middle">${h.x[i]}</text>`;});
    svg+='<text x="258" y="236" fill="#91acc0" font-size="9" text-anchor="middle">Wavelength column</text></svg>';
    $('hero-spectra').innerHTML=svg;
    $('hero-spectra').setAttribute('aria-label','Eight measured wheat-flour training spectra');
  }

  function renderOverview() {
    const models=dlModels().map(m=>m.id);
    if($('include-pls').checked) models.push('PLSRegression');
    if($('include-tabpfn').checked) models.push('TabPFN35');
    const scope=scopedDatasets();
    const result=calculateRanking(data.results,models,scope.map(d=>d.id));
    currentRanking=result.rows;commonDatasets=result.common;
    $('comparison-note').textContent=`${models.length} models · ${result.common.length} shared datasets out of ${scope.length} in this domain. `+(result.common.length<scope.length?'Datasets with any missing model result are excluded from this comparison.':'Every included model has results on the same datasets.');
    $('ranking-chart').innerHTML=result.rows.length?result.rows.map(r=>{
      const model=modelById.get(r.model);
      return `<div class="rank-row ${model.family==='Classical'?'reference':model.family==='Foundation'?'foundation':''}"><span class="rank-label">${escape(model.name)}</span><div class="rank-bar-track" role="img" aria-label="${escape(model.name)}: rank score ${format(r.score,2)} of 100"><div class="rank-bar" style="width:${Math.max(0,Math.min(100,r.score))}%"></div></div><span class="rank-value">${format(r.score,1)}</span></div>`;
    }).join('')+'<div class="rank-axis" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>':'<p class="empty">No shared completed datasets for this comparison yet. Exclude TabPFN-3.5 or choose another domain.</p>';
    $('ranking-table').querySelector('tbody').innerHTML=result.rows.map(r=>`<tr><td>${escape(modelById.get(r.model).name)}</td><td>${format(r.score,2)}</td><td>${format(r.rank,2)}</td><td>${format(r.r2,3)}</td><td>${r.datasets}</td><td>${format(r.seconds,1)}</td></tr>`).join('');
  }

  function populateDatasetSelect() {
    const previous=$('detail-dataset').value;
    $('detail-dataset').innerHTML=scopedDatasets().map(d=>`<option value="${escape(d.id)}">${d.number}. ${escape(d.label)} — ${escape(d.target)}</option>`).join('');
    if(scopedDatasets().some(d=>d.id===previous)) $('detail-dataset').value=previous;
  }

  function renderDetail() {
    const d=datasetById.get($('detail-dataset').value);if(!d)return;
    const metric=$('detail-metric').value;
    const rows=data.results.filter(r=>r.dataset===d.id).sort((a,b)=>metric==='rmse'?a.rmse-b.rmse:b.r2-a.r2);
    const missing=data.models.filter(m=>!rowFor(d.id,m.id));
    $('dataset-context').innerHTML=`<span><b>${escape(d.target)}</b> · ${escape(d.domain)}</span><span>${d.train.toLocaleString()} train / ${d.test.toLocaleString()} test</span><span>${d.features} channels</span><span>${rows.length} / ${data.models.length} models available</span>${missing.length?`<span>Awaiting: ${missing.map(m=>escape(m.name)).join(', ')}</span>`:''}`;
    const vals=rows.flatMap(r=>[r[metric]-(r[metric+'Std']??0),r[metric]+(r[metric+'Std']??0)]);
    let lo=Math.min(0,...vals),hi=Math.max(0,...vals);if(lo===hi)hi=lo+1;
    const span=hi-lo;hi+=span*.06;if(lo<0)lo-=span*.04;
    const width=940,left=185,right=90,plot=width-left-right,height=rows.length*32+52;
    const x=v=>left+(v-lo)/(hi-lo)*plot;
    let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metric==='rmse'?'Test RMSE':'Test R squared'} comparison for ${escape(d.label)}. Mean and one standard deviation across runs; exact values are in the table below.">`;
    for(let i=0;i<=5;i++){let v=lo+(hi-lo)*i/5;svg+=`<line x1="${x(v)}" x2="${x(v)}" y1="12" y2="${height-35}" stroke="#e6edf3"/><text x="${x(v)}" y="${height-13}" text-anchor="middle" font-size="10" fill="#637b91">${format(v,2)}</text>`;}
    svg+=`<line x1="${x(0)}" x2="${x(0)}" y1="12" y2="${height-35}" stroke="#98adbe"/>`;
    rows.forEach((r,i)=>{
      const m=modelById.get(r.model),v=r[metric],std=r[metric+'Std'],cy=24+i*32;
      const color=m.family==='Classical'?'#9b834e':m.id==='TabPFN35'?TABPFN_COLOR:'#2e638e';
      const desc=`${m.name}: ${format(v,4)}${std==null?' (single fit)':` ± ${format(std,4)} standard deviation`}`;
      svg+=`<text x="${left-16}" y="${cy+4}" text-anchor="end" font-size="11" fill="#163651">${escape(m.name)}</text><g class="point" tabindex="0" role="img" aria-label="${escape(desc)}"><title>${escape(desc)}</title>`;
      if(std!=null)svg+=`<line x1="${x(v-std)}" x2="${x(v+std)}" y1="${cy}" y2="${cy}" stroke="${color}" stroke-width="2"/><path d="M${x(v-std)},${cy-5}v10 M${x(v+std)},${cy-5}v10" stroke="${color}" stroke-width="1.3"/>`;
      svg+=`<circle cx="${x(v)}" cy="${cy}" r="4.5" fill="${color}" stroke="white" stroke-width="1.3"/></g><text x="${width-8}" y="${cy+4}" text-anchor="end" font-size="11" fill="#294a66">${format(v,3)}</text>`;
    });
    $('detail-chart').innerHTML=svg+'</svg>';
    $('detail-table').querySelector('tbody').innerHTML=rows.map(r=>`<tr><td>${escape(modelById.get(r.model).name)}</td><td>${format(r.rmse,4)}${r.rmseStd==null?'':` ± ${format(r.rmseStd,4)}`}</td><td>${format(r.r2,4)}${r.r2Std==null?'':` ± ${format(r.r2Std,4)}`}</td><td>${r.runs}</td><td>${r.model==='PLSRegression'?`${escape(r.preprocessing)} · ${format(r.lv,0)} LV`:'—'}</td><td class="source-path">${escape(r.source)}</td></tr>`).join('');
  }

  function renderMatrix(){
    const models=data.models;
    let html='<caption class="sr-only">Test RMSE matrix: each row is a dataset, each column a model</caption><thead><tr><th scope="col">Dataset / target</th>'+models.map(m=>`<th scope="col">${escape(m.name)}</th>`).join('')+'</tr></thead><tbody>';
    for(const d of scopedDatasets()){
      const available=models.map(m=>rowFor(d.id,m.id)).filter(Boolean);
      const values=available.map(r=>r.rmse).sort((a,b)=>a-b),best=values[0];
      html+=`<tr><td><button class="dataset-link" data-dataset="${escape(d.id)}">${d.number}. ${escape(d.label)}<span class="dataset-sub">${escape(d.target)}</span></button></td>`;
      for(const m of models){
        const r=rowFor(d.id,m.id);
        if(!r){html+='<td aria-label="No completed result">—</td>';continue;}
        const rank=values.indexOf(r.rmse),alpha=.06+.3*(1-rank/Math.max(1,values.length-1));
        html+=`<td style="background:rgba(24,163,153,${alpha.toFixed(3)})" title="${escape(m.name)}: ${format(r.rmse,5)}${r.rmseStd==null?' · single fit':` ± ${format(r.rmseStd,5)} SD`}">${r.rmse===best?'<b>':''}${format(r.rmse,3)}${r.rmse===best?'</b>':''}</td>`;
      }
      html+='</tr>';
    }
    $('matrix-table').innerHTML=html+'</tbody>';
  }

  function updateScope(){
    $('view-scope').textContent=tab==='overview'?`${currentRanking.length} models · ${commonDatasets.length} shared datasets`:tab==='detail'?'One dataset · all available models · original target units':`${scopedDatasets().length} datasets · all ${data.models.length} models · original target units`;
  }

  function renderResults(){renderOverview();populateDatasetSelect();renderDetail();renderMatrix();updateScope();}

  function showTab(next,focus=false){
    tab=next;
    document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===next;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus();});
    for(const key of ['overview','detail','matrix'])$(key).hidden=key!==next;
    updateScope();
  }

  function openDataset(id){
    if(!scopedDatasets().some(d=>d.id===id)){$('result-domain').value='all';renderResults();}
    $('detail-dataset').value=id;renderDetail();showTab('detail');
    $('results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }

  function renderDatasetBrowser(){
    const query=$('dataset-search').value.trim().toLowerCase();
    const datasets=data.datasets.filter(d=>(datasetDomain==='all'||d.domain===datasetDomain)&&`${d.id} ${d.label} ${d.target} ${d.domain}`.toLowerCase().includes(query));
    $('dataset-count').textContent=`${datasets.length} of ${data.datasets.length} configurations`;
    $('dataset-table').querySelector('tbody').innerHTML=datasets.length?datasets.map(d=>`<tr><td><span class="dataset-number">${String(d.number).padStart(2,'0')}</span><span class="dataset-title">${escape(d.label)}</span><span class="dataset-sub">${escape(d.target)}</span></td><td>${escape(d.domain)}</td><td>${d.train.toLocaleString()}</td><td>${d.test.toLocaleString()}</td><td>${d.features.toLocaleString()}</td><td><button class="text-button" data-dataset="${escape(d.id)}" aria-label="Explore results for ${escape(d.label)} ${escape(d.target)}">Explore ↗</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">No datasets match this search. Clear the search or select the active domain again to show all domains.</td></tr>';
    document.querySelectorAll('[data-domain]').forEach(b=>{const active=b.dataset.domain===datasetDomain;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  }

  function renderModels(){
    const family=$('model-family').value;
    $('model-grid').innerHTML=data.models.filter(m=>family==='all'||m.family===family).map(m=>{
      const upstream=/^https?:\/\//.test(m.codeHref);
      const sourceLabel=upstream?'Upstream source':'Python source';
      const sourceAria=upstream?'upstream source repository':'Python implementation';
      const code=`<a class="model-code-link" href="${escape(m.codeHref)}" target="_blank" rel="noopener" aria-label="Open ${escape(m.name)} ${sourceAria}">${sourceLabel} <span aria-hidden="true">↗</span></a>`;
      const citation=m.paperHref?`<a class="model-citation" href="${escape(m.paperHref)}" target="_blank" rel="noopener"><span class="citation-label">Original paper</span>${escape(m.citation)} <span aria-hidden="true">↗</span></a>`:`<p class="model-citation no-paper"><span class="citation-label">Provenance</span>${escape(m.citation)}</p>`;
      return `<article class="model-card ${m.family==='Foundation'?'foundation':''}"><span class="pill ${m.family==='Foundation'?'aqua':m.family==='Classical'?'neutral':''}">${escape(m.family)}</span><h3><a href="${escape(m.codeHref)}" target="_blank" rel="noopener" aria-label="Open ${escape(m.name)} ${sourceAria}">${escape(m.name)}</a></h3><p class="subtitle">${escape(m.subtitle)}</p><p class="description">${escape(m.description)}</p><div class="model-card-links">${citation}${code}<small>Benchmark module: ${escape(m.source)}</small></div></article>`;
    }).join('');
  }

  function downloadBlob(text,name,type){
    const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function csv(rows,keys){
    const cell=v=>{let s=v==null?'':String(v);if(/^[=+@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    return [keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n');
  }
  function exportMeasurements(rows,name){
    const records=rows.map(r=>({...r,label:datasetById.get(r.dataset).label,target:datasetById.get(r.dataset).target,domain:datasetById.get(r.dataset).domain}));
    downloadBlob(csv(records,['dataset','label','target','domain','model','rmse','rmseStd','r2','r2Std','seconds','runs','preprocessing','lv','cvRmse','cvR2','source']),name,'text/csv;charset=utf-8');
  }
  function exportView(){
    if(tab==='overview'){
      const rows=currentRanking.map(r=>({...r,domain:$('result-domain').value,shared_datasets:commonDatasets.join(';'),model_set:currentRanking.map(m=>m.model).join(';'),generated_at:data.generatedAt}));
      downloadBlob(csv(rows,['model','score','rank','r2','datasets','seconds','domain','shared_datasets','model_set','generated_at']),'nirbench-ranking.csv','text/csv;charset=utf-8');
    }else{
      const ids=tab==='detail'?[$('detail-dataset').value]:scopedDatasets().map(d=>d.id);
      exportMeasurements(data.results.filter(r=>ids.includes(r.dataset)),`nirbench-${tab}.csv`);
    }
  }

  async function refresh(manual=false){
    if(refreshing)return;refreshing=true;$('refresh').disabled=true;
    try{
      if(location.protocol==='file:'){live=false;return;}
      let response=await fetch('api/results',{cache:'no-store'});
      if(!response.ok){live=false;if(!manual)return;response=await fetch('data.json',{cache:'no-store'});}
      else live=true;
      if(!response.ok)throw new Error('No snapshot available');
      const next=await response.json();
      if(next.schemaVersion!==1||!Array.isArray(next.results)||!Array.isArray(next.datasets))throw new Error('Invalid snapshot');
      data=next;reindex();renderResults();
    }catch(error){live=false;console.info('Using saved NIRBENCH snapshot:',error.message);}
    finally{renderStatus();refreshing=false;$('refresh').disabled=false;}
  }

  const domains=[...new Set(data.datasets.map(d=>d.domain))];
  $('result-domain').innerHTML='<option value="all">All domains</option>'+domains.map(d=>`<option>${escape(d)}</option>`).join('');
  $('domain-cards').innerHTML=domains.map(domain=>`<button class="domain-card" data-domain="${escape(domain)}" aria-pressed="false"><strong>${data.datasets.filter(d=>d.domain===domain).length}</strong><span>${escape(domain)}</span></button>`).join('');
  document.querySelectorAll('[data-tab]').forEach(b=>{
    b.addEventListener('click',()=>showTab(b.dataset.tab));
    b.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const keys=['overview','detail','matrix'];let i=keys.indexOf(tab);
      i=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;showTab(keys[i],true);
    });
  });
  ['result-domain','include-pls','include-tabpfn'].forEach(id=>$(id).addEventListener('change',renderResults));
  ['detail-dataset','detail-metric'].forEach(id=>$(id).addEventListener('change',()=>{renderDetail();updateScope();}));
  $('dataset-search').addEventListener('input',renderDatasetBrowser);
  $('model-family').addEventListener('change',renderModels);
  document.addEventListener('click',event=>{
    const datasetButton=event.target.closest('[data-dataset]');if(datasetButton)openDataset(datasetButton.dataset.dataset);
    const domainButton=event.target.closest('[data-domain]');if(domainButton){datasetDomain=datasetDomain===domainButton.dataset.domain?'all':domainButton.dataset.domain;renderDatasetBrowser();}
  });
  const navToggle=document.querySelector('.nav-toggle');
  navToggle.addEventListener('click',()=>{const open=$('main-nav').classList.toggle('open');navToggle.setAttribute('aria-expanded',String(open));});
  $('main-nav').addEventListener('click',event=>{if(event.target.closest('a')){$('main-nav').classList.remove('open');navToggle.setAttribute('aria-expanded','false');}});
  $('download').addEventListener('click',exportView);
  const allCsv=$('all-csv');
  if(allCsv)allCsv.addEventListener('click',()=>exportMeasurements(data.results,'nirbench-all-results.csv'));
  const snapshotLink=document.querySelector('a[href="data.json"]');
  if(snapshotLink)snapshotLink.addEventListener('click',event=>{event.preventDefault();downloadBlob(JSON.stringify(data,null,2),'nirbench-snapshot.json','application/json');});
  $('refresh').addEventListener('click',()=>refresh(true));
  renderHero();renderStatus();renderResults();renderDatasetBrowser();renderModels();
  refresh();setInterval(()=>{if(live&&!document.hidden)refresh();},30000);
  window.NIRBENCH = {calculateRanking, getSnapshot:()=>data};
})();
