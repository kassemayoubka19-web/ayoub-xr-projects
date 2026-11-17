import {assessGLB,optimizeGLB,unzipA3D,zipA3D} from './optimizer-core.js';
if(!document.body.classList.contains('viewer-mode')) {
 const style=document.createElement('style');style.textContent=`
 #xrOptimizer {position:fixed;inset:0;z-index:9999;background:#000b;display:flex;align-items:center;justify-content:center;padding:14px;color:#e8f5ff;font-family:system-ui,sans-serif;direction:rtl}
 #xrOptimizer[hidden]{display:none!important}
 #xrOptimizer .xr-card{background:#101d2b;border:1px solid #47718f;border-radius:17px;padding:24px;width:min(780px,95vw);max-height:89vh;overflow:auto;box-shadow:0 14px 80px #0009}
 #xrOptimizer h2{margin:0 0 10px;font-size:23px;color:#eff8ff}
 #xrOptimizer p,#xrOptimizer small{color:#bdd2e2;line-height:1.7}
 #xrOptimizer label{display:block;margin:13px 0}
 #xrOptimizer select,#xrOptimizer input,#xrOptimizer button{font:inherit}
 #xrOptimizer select,#xrOptimizer input[type=file]{width:100%;padding:10px;border:1px solid #557082;background:#162a3b;color:#fff;border-radius:9px}
 #xrOptimizer .xr-actions{display:flex;gap:12px;flex-wrap:wrap}
 #xrOptimizer button{padding:11px 16px;border-radius:9px;background:#186b8f;border:1px solid #81b9d3;color:white;cursor:pointer}
 #xrOptimizer button:disabled{opacity:.5;cursor:not-allowed}
 #xrOptimizer .xr-close{float:left;background:#273746}
 #xrOptimizer progress{width:100%;accent-color:#55b6e2}
 #xrOptimizer pre{white-space:pre-wrap;background:#0b1522;border-radius:9px;padding:12px;font-size:13px}
 #xrOptimizer .xr-alert{border-right:3px solid #f0b04c;padding:5px 12px;background:#372a17}
 `;document.head.append(style);
 const toolbar=document.querySelector('.header-actions');
 if(toolbar){const trigger=document.createElement('button');trigger.id='xrOptimizerLaunch';trigger.textContent='⚙ تحويل وضغط المشروع';trigger.type='button';toolbar.insertBefore(trigger,document.getElementById('exportBtn'));
 const overlay=document.createElement('div');overlay.id='xrOptimizer';overlay.hidden=true;
 overlay.innerHTML=`<section class="xr-card" role="dialog" aria-label="تحويل وضغط النموذج"><button id="xrClose" class="xr-close" type="button">× إغلاق</button><h2>AYOUB XR — تجهيز مشروع خفيف للويب</h2>
 <p>اختر ملف GLB أو مشروع A3D. تتم المعالجة على جهازك، دون رفع الملفات إلى الإنترنت. ينتج ملف جديد باسم optimized مع بقاء الأصل كما هو.</p>
 <label>ملف المشروع <input id="xrFile" type="file" accept=".glb,.a3d,.fbx,.obj,.stl,.dae,.gltf,.rvt,.max,.skp,.dwg,.ifc,.step,.stp,.iges,.igs"></label>
 <label>مستوى ضغط الخامات<select id="xrQuality"><option value="4096">محافظ — حد أقصى 4096 بكسل</option><option value="2048" selected>متوازن — حد أقصى 2048 بكسل</option><option value="1024">هاتف — حد أقصى 1024 بكسل</option></select></label>
 <p class="xr-alert">يُحافظ على بيانات المثلثات والإحداثيات الأصلية، لكن إعادة ضغط JPEG وتصغير الصور قد تقلّل بعض التفاصيل الدقيقة. لا يوجد حتى الآن تبسيط هندسي Mesh Decimation أو تحويل مباشر لملفات RVT/MAX/DWG.</p>
 <div class="xr-actions"><button id="xrRun" type="button">تحسين وحفظ المشروع</button><button id="xrDownloadGlb" type="button" hidden>حفظ النموذج GLB</button><button id="xrDownloadA3d" type="button" hidden>حفظ مشروع A3D</button></div>
 <label>التقدم <progress id="xrProgress" max="100" value="0"></progress></label><pre id="xrStatus">اختر ملفًا للبدء.</pre><small>لملفات Revit/3ds Max والملفات المغلقة: استخدم التصدير إلى GLB/FBX/OBJ أو محولًا مرخصًا يدعم الإصدار؛ لا يمكن الادعاء بفتح أي صيغة أصلية مباشرة.</small></section>`;
 document.body.append(overlay);const $=id=>document.getElementById(id);const close=()=>overlay.hidden=true;trigger.onclick=()=>overlay.hidden=false;$('xrClose').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close();};
 let result=null,resultA3d=null,base='project';const status=message=>$('xrStatus').textContent=message;
 const download=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);};
 $('xrRun').onclick=async()=>{
  const f=$('xrFile').files?.[0];if(!f){status('اختر ملف المشروع أولًا.');return;}
  $('xrRun').disabled=true;$('xrDownloadGlb').hidden=true;$('xrDownloadA3d').hidden=true;
  const ext=f.name.split('.').pop().toLowerCase();base=f.name.replace(/\.[^.]+$/,'').replace(/[^\w\-\u0600-\u06ff]/g,'-').slice(0,75)||'project';
  try{
   if(!['glb','a3d'].includes(ext))throw Error('يستورد البرنامج GLB وglTF وOBJ/MTL وSTL وDAE من نافذة الاستيراد الأساسية. لتحسين نموذج بهذه الصيغة، استورده أولًا ثم احفظه GLB. الصيغ RVT/MAX/SKP/DWG/IFC/STEP تحتاج مسار تحويل منفصل.');
   status('قراءة الملف وفحصه…');const raw=new Uint8Array(await f.arrayBuffer());const members=ext==='a3d'?await unzipA3D(raw):null;
   const original=members?.['model.glb']||raw,pre=assessGLB(original);
   const optimized=await optimizeGLB(original,{maxTexture:Number($('xrQuality').value),quality:.86},(pct,msg)=>{$('xrProgress').value=pct;status(msg);});
   const post=assessGLB(optimized.data);
   result=new Blob([optimized.data],{type:'model/gltf-binary'});resultA3d=members?await zipA3D({...members,'model.glb':optimized.data},()=>{}):null;
   $('xrProgress').value=100;
   status(`نجح الفحص.\nقبل: ${(pre.bytes/1048576).toFixed(1)} MiB\nبعد: ${(post.bytes/1048576).toFixed(1)} MiB\nخفض الحجم: ${optimized.stats.reduction}%\nصور الخامات: ${optimized.stats.changed} تحسنت من أصل ${pre.images}\nعدد العقد: ${pre.nodes} → ${post.nodes}\nالمثلثات التقديرية: ${pre.triangles} → ${post.triangles}\nالهندسة والبيانات الهندسية: محفوظة بايتًا مقابل بايت.\nملاحظة: ضغط ZIP لمشروع A3D قد يخفض حجم النقل أكثر دون تغيير محتواه.`);
   $('xrDownloadGlb').hidden=false;if(resultA3d)$('xrDownloadA3d').hidden=false;
  }catch(e){$('xrProgress').value=0;status('تعذر الإكمال: '+(e?.message||e));}
  finally{$('xrRun').disabled=false;}
 };
 $('xrDownloadGlb').onclick=()=>{if(result)download(result,base+'-optimized.glb');};
 $('xrDownloadA3d').onclick=()=>{if(resultA3d)download(resultA3d,base+'-optimized.a3d');};
 }
}
