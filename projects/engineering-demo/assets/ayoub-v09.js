/* AYOUB XR QUALITY STUDIO — closed-client presentation layer.
   All computation is local. Preserve input geometry; never alter vertices. */
import {parseIES,iesCookieData} from './xr-lighting-core.js';
import {readRadiance} from './hdr-parser.js';
let runtime=window.__AYOUB_V09_ENGINE__;
// Wait for the large project loader before mounting renderer-dependent controls.
for(let attempt=0;!runtime&&attempt<600;attempt++){await new Promise(r=>setTimeout(r,50));runtime=window.__AYOUB_V09_ENGINE__;}
if(!runtime)throw Error('AYOUB XR engine unavailable after initialization timeout');
const {viewer,getModel,T,notify}=runtime;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const el=(tag,cls='',text='')=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text)x.textContent=text;return x;};
const IN_BROWSER=document.body.classList.contains('viewer-mode');
const PRESETS={
 daylight:{sun:'#fff1d4',ambient:'#d5e6ff',power:2.65,hemi:1.3,exposure:1.04,az:29,alt:62,clear:'#b0cce5'},
 golden:{sun:'#ffbc7a',ambient:'#b2b4d9',power:2.8,hemi:.85,exposure:1.06,az:60,alt:15,clear:'#b5a6b3'},
 blue:{sun:'#c3dcff',ambient:'#8aabd7',power:.42,hemi:.62,exposure:1.0,az:60,alt:2,clear:'#3c668c'},
 night:{sun:'#8ca6ff',ambient:'#536a89',power:.08,hemi:.28,exposure:1.25,az:60,alt:-8,clear:'#142b45'},
 interior:{sun:'#ffeed0',ambient:'#d9e5ff',power:.5,hemi:.85,exposure:1.15,az:45,alt:35,clear:'#a0b5c4'}
};
const base={version:1,preset:'daylight',exposure:1.04,quality:'auto',hdri:null,fixtures:[],background:false};
let state={...base};let lightingFiles=new Map();let environment=null,environmentSource=null,iesLights=[],layerGroups=[],activeLayer=null;let indexVersion=0,lastModel=null,lastModelScan=0;
const doc=document;
const root=el('section','xr9-root');root.dir='rtl';root.id='xr9Root';
const header=el('div','xr9-head');const projectTitle=el('strong','xr9-name','المشروع');header.append(projectTitle);
const toggle=el('button','xr9-toggle','☷ إعدادات العرض');toggle.type='button';toggle.setAttribute('aria-label','خيارات عرض المشروع');header.append(toggle);
const menu=el('div','xr9-menu');
const tabs=el('div','xr9-tabs');const panes=el('div','xr9-panes');let currentTab='layers';
const tabNames={layers:'الطبقات',scene:'الإضاءة',quality:'الأداء',report:'الفحص'};
for(const [id,title] of Object.entries(tabNames)){const b=el('button','xr9-tab',title);b.type='button';b.dataset.tab=id;b.addEventListener('click',()=>selectTab(id));tabs.append(b);}
menu.append(tabs,panes);root.append(header,menu);const stage=doc.querySelector('.stage')||doc.body;stage.append(root);
const panesById={};for(const id of Object.keys(tabNames)){const p=el('div','xr9-pane');p.dataset.pane=id;panesById[id]=p;panes.append(p);}
function selectTab(id){currentTab=id;for(const b of tabs.children)b.classList.toggle('selected',b.dataset.tab===id);for(const p of Object.values(panesById))p.hidden=p.dataset.pane!==id;}
function notice(msg){notify?.(msg);status.textContent=msg;}
const status=el('p','xr9-status');
root.querySelector('.xr9-head').append();
root.querySelector('.xr9-menu').append(status);
function updateProjectTitle(){const p=doc.getElementById('projectTitle')?.textContent?.trim()||getModel()?.report?.title||'المشروع';projectTitle.textContent=p; if(IN_BROWSER){const brand=doc.querySelector('.topbar .brand');if(brand){brand.replaceChildren(el('strong','',p));}doc.title=p+' — عرض ثلاثي الأبعاد';}}
new MutationObserver(updateProjectTitle).observe(doc.getElementById('projectTitle')||doc.body,{childList:true,characterData:true,subtree:true});updateProjectTitle();
toggle.addEventListener('click',()=>{const opened=root.classList.toggle('opened');toggle.setAttribute('aria-expanded',String(opened));});
selectTab('layers');

// Source layers are authoritative. Unclassified geometry is identified explicitly.
const layerPane=panesById.layers;
const layerSearch=el('input','xr9-search');layerSearch.placeholder='البحث عن طبقة أو مجموعة';layerSearch.type='search';layerSearch.setAttribute('aria-label','البحث عن الطبقات');layerPane.append(layerSearch);
const layerActions=el('div','xr9-actions');
const showAll=el('button','','إظهار الجميع');const hideAll=el('button','','إخفاء الجميع');const unIsolate=el('button','','إنهاء العزل');
layerActions.append(showAll,hideAll,unIsolate);layerPane.append(layerActions);
const layerSummary=el('p','xr9-muted');const layerList=el('div','xr9-layerlist');layerPane.append(layerSummary,layerList);
function createLayerGroups(){const current=getModel();lastModel=current;
  const result=new Map();if(!current?.root){layerGroups=[];layerSummary.textContent='افتح مشروعًا أولًا';return;}
  const rootNode=current.root;let objectCount=0;
  rootNode.traverse(obj=>{
    if(!obj.isMesh&&!obj.isLine&&!obj.isPoints)return;
    let candidate=obj;let layer='';
    while(candidate&&candidate!==rootNode){const src=candidate.userData||{};
      const found=[src.layer,src.cadLayer,src.sourceLayer,src.layerName].find(x=>typeof x==='string'&&x.trim());
      if(found){layer=found.trim().slice(0,120);break;}candidate=candidate.parent;
    }
    const type=layer?'source':'unknown';const name=layer||'عناصر غير مصنّفة في الملف الأصلي';const key=type+':'+name;
    if(!result.has(key))result.set(key,{key,name,type,items:[]});result.get(key).items.push(obj);objectCount++;
  });
  layerGroups=[...result.values()].sort((a,b)=>a.type===b.type?a.name.localeCompare(b.name):a.type==='source'?-1:1);
  layerSummary.textContent=`${layerGroups.length} مجموعة · ${objectCount.toLocaleString('en-US')} عنصر · طبقات المصدر: ${layerGroups.filter(x=>x.type==='source').length}`;
  renderLayers();
}
function renderLayers(){const q=layerSearch.value.trim().toLowerCase();const items=layerGroups.filter(g=>!q||g.name.toLowerCase().includes(q));layerList.replaceChildren();
  for(const g of items){const row=el('div','xr9-layer');const checked=g.items.some(o=>o.visible);const chk=el('input');chk.type='checkbox';chk.checked=checked;chk.setAttribute('aria-label','إظهار '+g.name);chk.addEventListener('change',()=>{g.items.forEach(o=>o.visible=chk.checked);viewer.invalidate();renderLayers();});
    const label=el('span','xr9-layer-name',g.name);label.title=g.type==='source'?'اسم طبقة من المصدر':'لا تتضمن بيانات المصدر اسم طبقة موثوقًا';
    const count=el('small','xr9-count',String(g.items.length));const solo=el('button','xr9-solo','عزل');solo.setAttribute('aria-label','عزل '+g.name);solo.addEventListener('click',()=>{layerGroups.forEach(item=>item.items.forEach(o=>o.visible=item===g));activeLayer=g.key;viewer.invalidate();renderLayers();});
    row.append(chk,label,count,solo);if(activeLayer===g.key)row.classList.add('isolated');layerList.append(row);
  }
  if(!items.length)layerList.append(el('p','xr9-muted','لا توجد طبقات مطابقة.'));
}
const changeAll=flag=>{for(const g of layerGroups)for(const o of g.items)o.visible=flag;activeLayer=null;viewer.invalidate();renderLayers();};
showAll.onclick=()=>changeAll(true);hideAll.onclick=()=>changeAll(false);unIsolate.onclick=()=>changeAll(true);layerSearch.oninput=renderLayers;

// Lighting & tone mapping with real HDR Radiance floating-point data import.
const scenePane=panesById.scene;
function field(label,input){const group=el('label','xr9-field');group.append(el('span','',label),input);scenePane.append(group);return input;}
const presetSelect=el('select');for(const [key,value] of Object.entries({daylight:'نهار',golden:'غروب',blue:'ساعة زرقاء',night:'ليل',interior:'إضاءة داخلية'})){const opt=el('option','',value);opt.value=key;presetSelect.append(opt);}field('إعداد أجواء المشهد',presetSelect);
const exposure=el('input');exposure.type='range';exposure.min='.5';exposure.max='2';exposure.step='.05';field('التعريض',exposure);
const hdriUpload=el('input');hdriUpload.type='file';hdriUpload.accept='.hdr';field('إضاءة HDRI (.hdr)',hdriUpload);
const iesUpload=el('input');iesUpload.type='file';iesUpload.accept='.ies';field('إضافة كشاف IES',iesUpload);
const hdriBackground=el('input');hdriBackground.type='checkbox';field('إظهار البيئة في الخلفية',hdriBackground);
const sceneHint=el('p','xr9-muted','الإضاءة البيئية PBR وانعكاسات HDRI تعمل مباشرة. إسقاط IES تقريبي ويحتاج ضبط الاتجاه؛ هذه ليست إضاءة عالمية متعددة الارتدادات.');scenePane.append(sceneHint);
function applyPreset(name=state.preset){const p=PRESETS[name]||PRESETS.daylight;
  const sun=viewer.scene.children.find(x=>x.isDirectionalLight),hem=viewer.scene.children.find(x=>x.isHemisphereLight);
  if(sun){sun.color.set(p.sun);sun.intensity=p.power;const a=p.alt*Math.PI/180,z=p.az*Math.PI/180;sun.position.set(Math.cos(a)*Math.cos(z)*35,Math.sin(a)*35,Math.cos(a)*Math.sin(z)*35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00012;sun.shadow.normalBias=.015;const span=Math.max(15,Math.min(300,(viewer.diagonal||20)*1.2));Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:.1,far:Math.max(100,span*6)});sun.shadow.camera.updateProjectionMatrix();}
  if(hem){hem.color.set(p.ambient);hem.intensity=p.hemi;}
  viewer.renderer.shadowMap.enabled=true;viewer.renderer.shadowMap.type=2;
  viewer.renderer.toneMappingExposure=clamp(state.exposure||p.exposure,.5,2);if(!environmentSource){viewer.scene.background=new T.Color(p.clear);}viewer.scene.backgroundIntensity=1;viewer.invalidate();
}
presetSelect.addEventListener('change',()=>{state.preset=presetSelect.value;state.exposure=PRESETS[state.preset].exposure;exposure.value=String(state.exposure);applyPreset();});
exposure.addEventListener('input',()=>{state.exposure=Number(exposure.value);applyPreset();});
function disposeEnv(){if(environment){environment.dispose();environment=null;}if(environmentSource){environmentSource.dispose();environmentSource=null;}}
async function loadHDR(bytes){const {width,height,data}=readRadiance(bytes);const source=new T.DataTexture(data,width,height,1023,1015);source.mapping=303;source.minFilter=1006;source.magFilter=1006;source.flipY=true;source.needsUpdate=true;const gen=new T.PMREMGenerator(viewer.renderer);
  try{const target=gen.fromEquirectangular(source);disposeEnv();environment=target;environmentSource=source;viewer.scene.environment=environment.texture;viewer.scene.background=state.background?source:null;viewer.scene.environmentIntensity=1.15;viewer.invalidate();return {width,height};}catch(e){source.dispose();throw e;}finally{gen.dispose();}
}
hdriUpload.addEventListener('change',async()=>{const f=hdriUpload.files?.[0];if(!f)return;
  try{if(f.size>24*1024*1024)throw Error('HDRI أكثر من 24 MB');const bytes=new Uint8Array(await f.arrayBuffer());const wh=await loadHDR(bytes);lightingFiles.set('lighting/environment.hdr',bytes);state.hdri='lighting/environment.hdr';notice(`HDRI ${wh.width}×${wh.height} — تم تطبيق البيئة والانعكاسات`);}catch(e){notice('تعذر HDRI: '+e.message);}
});
hdriBackground.addEventListener('change',()=>{state.background=hdriBackground.checked;if(environmentSource)viewer.scene.background=state.background?environmentSource:null;viewer.invalidate();});
function clearIES(){for(const e of iesLights){viewer.scene.remove(e.light,e.light.target);e.light.map?.dispose();}iesLights=[];}
function installIES(profile,fixture){const size=128,can=document.createElement('canvas');can.width=can.height=size;
 const ctx=can.getContext('2d'),pix=ctx.createImageData(size,size);pix.data.set(iesCookieData(profile,fixture.angle,size));ctx.putImageData(pix,0,0);
 const tex=new T.Texture(can);tex.needsUpdate=true;const spot=new T.SpotLight(fixture.color,fixture.intensity,fixture.distance,fixture.angle*Math.PI/180,.15,2);
 spot.position.set(...fixture.position);spot.target.position.set(...fixture.target);spot.map=tex;spot.castShadow=false;viewer.scene.add(spot,spot.target);iesLights.push({light:spot,fixture});viewer.invalidate();
}
iesUpload.addEventListener('change',async()=>{const f=iesUpload.files?.[0];if(!f)return;
 try{if(f.size>2*1024*1024)throw Error('IES أكبر من 2 MB');if(state.fixtures.length>=8)throw Error('تم بلوغ الحد الأقصى للكشافات التفاعلية');const raw=await f.text(),profile=parseIES(raw);
  const pos=viewer.camera.position,dir=viewer.camera.getWorldDirection(new T.Vector3());const fixture={path:`lighting/fixture${state.fixtures.length}.ies`,name:f.name,position:[pos.x,pos.y,pos.z],target:pos.clone().addScaledVector(dir,3).toArray(),color:'#fff1d9',intensity:60,angle:55,distance:25};
  state.fixtures.push(fixture);lightingFiles.set(fixture.path,new TextEncoder().encode(raw));installIES(profile,fixture);notice('أضيف مصدر IES عند موضع الكاميرا الحالي. اضبطه مقابل مخطط الإنارة.');
 }catch(e){notice('تعذر IES: '+e.message);}
});

const qualityPane=panesById.quality;
const qualitySelect=el('select');for(const [v,t] of Object.entries({auto:'تلقائي',mobile:'هاتف',balanced:'متوازن',high:'عالي'})){const opt=el('option','',t);opt.value=v;qualitySelect.append(opt);}const qlabel=el('label','xr9-field');qlabel.append(el('span','','دقة العرض'),qualitySelect);qualityPane.append(qlabel);
const fps=el('p','xr9-muted','المشهد جاهز');qualityPane.append(fps);
function setQuality(){const requested=state.quality==='auto'?(matchMedia('(pointer: coarse)').matches?'mobile':'balanced'):state.quality;const factor={mobile:.8,balanced:1.25,high:2}[requested]||1.25;
 const ratio=Math.min(window.devicePixelRatio||1,factor);viewer.renderer.setPixelRatio(ratio);viewer.resize();viewer.invalidate();qualitySelect.value=state.quality;}
qualitySelect.addEventListener('change',()=>{state.quality=qualitySelect.value;setQuality();});
let frames=0,last=performance.now();
function measureFPS(now){frames++;if(now-last>=1500){const rate=frames*1000/(now-last);fps.textContent=`${Math.round(rate)} FPS · إعداد ${qualitySelect.selectedOptions[0].textContent} · ${getModel()?.report?.triangles?.toLocaleString('en-US')||0} مثلث`;frames=0;last=now;}
 if(root.isConnected)requestAnimationFrame(measureFPS);}requestAnimationFrame(measureFPS);

// Preflight measures what the model actually contains, without inventing missing CAD structure.
const preflight=panesById.report;const preflightBody=el('div','xr9-audit');preflight.append(preflightBody);
function audit(){const m=getModel();if(!m){preflightBody.textContent='لا يوجد نموذج';return;}let uv=0,textures=0,missing=0,unnamed=0,parts=0;
 m.root.traverse(o=>{if(!o.isMesh)return;parts++;if(!o.name)unnamed++;if(!o.geometry?.attributes?.uv)uv++;const mat=[].concat(o.material||[]);if(mat.some(x=>x?.map||x?.normalMap||x?.roughnessMap))textures++;else missing++;});
 const rows=[['المكوّنات',parts],['المكونات بلا UV',uv],['عناصر بلا خرائط خامات',missing],['عناصر بلا أسماء',unnamed],['طبقات المصدر',layerGroups.filter(x=>x.type==='source').length],['مجموعات غير مصنّفة',layerGroups.filter(x=>x.type==='unknown').length]];
 preflightBody.replaceChildren(...rows.map(([a,b])=>{const r=el('div','xr9-audit-row');r.append(el('span','',a),el('strong','',String(b)));return r;}));
 preflightBody.append(el('p','xr9-muted','فحص هندسي أولي، وليس توثيقًا لدقة القياسات أو مطابقة الإضاءة للواقع.'));
}
function refresh(){if(getModel()===lastModel)return;createLayerGroups();updateProjectTitle();audit();applyPreset();setQuality();}
const originalSetModel=viewer.setModel.bind(viewer);viewer.setModel=(model)=>{const r=originalSetModel(model);lastModel=null;setTimeout(refresh,0);return r;};
const timer=setInterval(()=>{refresh();if(!root.isConnected)clearInterval(timer);},1800);
function sanitizeState(v){const p=v&&typeof v==='object'?v:{};return {version:1,preset:PRESETS[p.preset]?p.preset:'daylight',exposure:clamp(Number(p.exposure)||1.04,.5,2),quality:['auto','mobile','balanced','high'].includes(p.quality)?p.quality:'auto',hdri:p.hdri==='lighting/environment.hdr'?p.hdri:null,background:!!p.background,fixtures:Array.isArray(p.fixtures)?p.fixtures.slice(0,8).filter(f=>f&&/^lighting\/fixture[0-7]\.ies$/.test(f.path)&&Array.isArray(f.position)&&f.position.length===3&&Array.isArray(f.target)&&f.target.length===3).map(f=>({...f,name:String(f.name||'IES').slice(0,80),intensity:clamp(Number(f.intensity)||60,1,300),angle:clamp(Number(f.angle)||55,5,89),distance:clamp(Number(f.distance)||25,.1,100)})):[]};}
async function restore(incoming,files={}){state=sanitizeState(incoming);lightingFiles=new Map(Object.entries(files||{}).filter(([k,v])=>k.startsWith('lighting/')&&v instanceof Uint8Array));clearIES();presetSelect.value=state.preset;exposure.value=String(state.exposure);qualitySelect.value=state.quality;hdriBackground.checked=state.background;applyPreset();setQuality();
 if(state.hdri){let bytes=lightingFiles.get(state.hdri);if(!bytes){const resp=await fetch(new URL('../'+state.hdri,import.meta.url));if(resp.ok)bytes=new Uint8Array(await resp.arrayBuffer());}
  if(bytes){try{await loadHDR(bytes);}catch(e){notice('تعذر استعادة HDRI: '+e.message);}}}
 for(const f of state.fixtures){let bytes=lightingFiles.get(f.path);if(!bytes){try{const resp=await fetch(new URL('../'+f.path,import.meta.url));if(resp.ok)bytes=new Uint8Array(await resp.arrayBuffer());}catch{}}
  if(bytes){try{installIES(parseIES(new TextDecoder().decode(bytes)),f);}catch(e){notice('IES: '+e.message);}}}
}
const api={snapshot:()=>sanitizeState(state),files:()=>Object.fromEntries(lightingFiles),restore,refresh,parseHDR:readRadiance,get layers(){return layerGroups.length;},get scene(){return state.preset;}};
window.__ayoubXRPro=api;restore(window.__ayoubV09Pending||null,window.__ayoubV09Assets||{}).catch(e=>notice('إضاءة: '+e.message));refresh();
