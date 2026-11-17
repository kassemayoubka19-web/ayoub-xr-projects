/* Client presentation policy, enabled only by the exported project's HTML. */
(async()=>{
 if(document.body.dataset.clientBackground!=='white')return;
 for(let i=0;i<1200&&(!window.__AYOUB_V09_ENGINE__||document.body.dataset.projectReady!=='true');i++)await new Promise(r=>setTimeout(r,50));
 const e=window.__AYOUB_V09_ENGINE__;if(!e)return;const v=e.viewer,white=new e.T.Color('#ffffff');
 const render=v.renderer.render.bind(v.renderer);
 v.renderer.render=(scene,camera)=>{scene.background=white;for(const child of scene.children)if(child.isMesh&&child.renderOrder===-1000)child.visible=false;return render(scene,camera);};
 v.renderer.setClearColor('#ffffff',1);v.scene.background=white;if(v.grid)v.grid.visible=false;v.controls.enableDamping=true;v.controls.dampingFactor=.085;v.invalidate();
 document.querySelector('.xr9-toggle').textContent='☷ الطبقات والعرض';
 const layerButton=document.getElementById('clientLayers');if(layerButton)layerButton.onclick=()=>document.querySelector('.xr9-toggle').click();
 document.body.dataset.clientPresentationReady='true';
 const cfg=await(await fetch(new URL('./project.json',document.baseURI))).json(),layers=cfg.clientDelivery?.layers||[];
 if(layers.length){
  const states=Object.fromEntries(layers.map(l=>[l.name,l.visible!==false])),items=[];e.getModel().root.traverse(o=>{if(!o.isMesh)return;let info=null;for(let p=o;p;p=p.parent)if(Array.isArray(p.userData?.sourceLayers)){info=p.userData;break;}items.push({object:o,names:info?.sourceLayers||['Layer0'],hidden:!!info?.sourceHidden});});
  const list=document.querySelector('.xr9-layerlist'),search=document.querySelector('.xr9-search');let isolated=null,showHidden=false;
  const apply=()=>{for(const i of items)i.object.visible=(showHidden||!i.hidden)&&i.names.every(n=>states[n]!==false);v.invalidate();};
  function draw(){const q=search.value.trim();list.replaceChildren();for(const layer of layers.filter(l=>!q||l.name.includes(q))){
    const row=document.createElement('div');row.className='xr9-layer';const c=document.createElement('input');c.type='checkbox';c.checked=states[layer.name];c.dataset.layer=layer.name;c.setAttribute('aria-label','إظهار '+layer.name);
    c.onchange=()=>{states[layer.name]=c.checked;isolated=null;apply();draw();};const name=document.createElement('span');name.className='xr9-layer-name';name.textContent=layer.name==='Layer0'?'العناصر الرئيسية · Layer0':layer.name;
    const count=document.createElement('small');count.className='xr9-count';count.textContent=String(items.filter(i=>i.names.includes(layer.name)).length);const solo=document.createElement('button');solo.className='xr9-solo';solo.textContent='عزل';solo.onclick=()=>{for(const l of layers)states[l.name]=true;for(const i of items)i.object.visible=i.names.includes(layer.name);isolated=layer.name;v.invalidate();draw();};row.append(c,name,count,solo);if(isolated===layer.name)row.classList.add('isolated');list.append(row);
   }}
  search.oninput=draw;const actions=document.querySelector('.xr9-actions').children;
  actions[0].onclick=actions[2].onclick=()=>{for(const l of layers)states[l.name]=true;showHidden=true;isolated=null;apply();draw();};actions[1].onclick=()=>{for(const l of layers)states[l.name]=false;isolated=null;apply();draw();};
  document.querySelector('.xr9-pane[data-pane=layers] .xr9-muted').textContent=layers.length+' طبقات من المشروع الأصلي';apply();draw();window.__clientLayers={states,items,apply,draw};
 }
})().catch(console.error);
