/* Desktop delivery UI. Published viewers have no desktop privileges. */
(async()=>{
 if(!window.desktop?.publishProject)return;
 for(let i=0;!window.__studioDelivery&&i<600;i++)await new Promise(r=>setTimeout(r,50));
 const bridge=window.__studioDelivery;if(!bridge)return;
 const $=id=>document.getElementById(id),section=$('desktopPublish');section.hidden=false;
 const status=$('exportStatus'),button=$('publishBtn');let busy=false,current={},lastTitle='';
 const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 function showError(e){status.replaceChildren(node('p',e.message||String(e)));status.className='error';}
 function setBusy(value){busy=value;for(const id of ['publishBtn','previewProjectBtn','refreshPublishBtn','publishedProjects','repoName','projectSlug','publishDomain'])$(id).disabled=value;}
 function showResult(r){
  document.body.dataset.publishStatus=r.status||'preview';document.body.dataset.publishedURL=r.url;
  status.className='';status.replaceChildren(node('p',r.message||''));
  const link=node('a',r.url);link.href=r.url;link.target='_blank';link.rel='noopener';link.dir='ltr';link.className='published-link';link.onclick=e=>{e.preventDefault();window.desktop.openPublishedURL(r.url).catch(showError);};status.append(link);
  const actions=node('div','');actions.className='publish-result-actions';
  const copy=node('button','نسخ الرابط');copy.type='button';copy.onclick=async()=>{try{await window.desktop.copyPublishedURL(r.url);copy.textContent='تم نسخ الرابط';}catch(e){showError(e);}};actions.append(copy);
  const open=node('button','فتح المشروع');open.type='button';open.onclick=()=>window.desktop.openPublishedURL(r.url).catch(showError);actions.append(open);
  if(r.slug){const check=node('button','فحص الرابط مجددًا');check.type='button';check.onclick=()=>execute(async()=>showResult(await window.desktop.checkPublishedProject(r.slug)),'فحص النسخة المنشورة…');actions.append(check);}
  status.append(actions);if(r.status==='pending'&&r.domain&&r.dns)status.append(node('small','الدومين: '+r.domain+' — وجهة CNAME المطلوبة: '+r.dns.cname+'. قد يلزم إكمال إعداد DNS أو انتظار شهادة HTTPS.'));
 }
 async function execute(fn,label){if(busy)return;setBusy(true);status.className='';status.textContent=label;try{await fn();}catch(e){showError(e);}finally{setBusy(false);}}
 async function refresh(){
  if(busy)return;const s=await window.desktop.publishingStatus();current=s;
  $('publishAccount').textContent=s.connected?'متصل بحساب GitHub: '+s.login:s.message;
  if(!$('repoName').value)$('repoName').value=s.repo||'ayoub-xr-projects';
  if(!$('publishDomain').value)$('publishDomain').value=s.domain||'';
  const list=$('publishedProjects'),selected=list.value;list.replaceChildren(node('option','مشروع جديد'));
  list.firstChild.value='';for(const [slug,p]of Object.entries(s.projects||{}).sort((a,b)=>(b[1].release?.createdAt||'').localeCompare(a[1].release?.createdAt||''))){const option=node('option',p.title+' — '+slug);option.value=slug;list.append(option);}list.value=selected;
  const title=$('exportTitle').value.trim();if(title!==lastTitle||!$('projectSlug').value){const found=Object.entries(s.projects||{}).find(([,p])=>p.title===title);$('projectSlug').value=found?.[0]||'project-'+Date.now().toString(36);list.value=found?.[0]||'';lastTitle=title;}
 }
 $('publishedProjects').onchange=()=>{const slug=$('publishedProjects').value;if(!slug){$('projectSlug').value='project-'+Date.now().toString(36);status.textContent='سيُنشأ مشروع مستقل برابط جديد.';return;}const p=current.projects[slug];$('projectSlug').value=slug;$('repoName').value=p.repo.split('/')[1];$('publishDomain').value=p.domain||'';showResult(p);};
 $('refreshPublishBtn').onclick=()=>refresh().catch(showError);
 $('previewProjectBtn').onclick=()=>execute(async()=>{const pack=await bridge.webArchive();const result=await window.desktop.previewProject({bytes:pack.bytes});showResult(result);await window.desktop.openPublishedURL(result.url);},'تجهيز معاينة المتصفح…');
 button.onclick=()=>execute(async()=>{
  if(!$('publicConsent').checked)throw Error('أكد موافقتك على إتاحة النموذج والتقرير للعامة.');
  if(!bridge.canExport())throw Error('راجع فحص المشروع قبل النشر.');
  const request={repo:$('repoName').value.trim(),slug:$('projectSlug').value.trim().toLowerCase(),domain:$('publishDomain').value.trim(),consent:true};
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,79}$/.test(request.repo))throw Error('اسم وجهة النشر غير صالح.');
  if(!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(request.slug))throw Error('معرّف المشروع: 2–64 حرفًا إنجليزيًا صغيرًا أو رقمًا أو - أو _.');
  const pack=await bridge.webArchive();request.bytes=pack.bytes;const result=await window.desktop.publishProject(request);showResult(result);current.projects||={};current.projects[result.slug]=result;
 },'تجهيز ملفات المشروع للنشر…');
 window.desktop.onPublishProgress(p=>{if(busy){status.className='';status.textContent=p.message;}});
 $('exportBtn').addEventListener('click',()=>refresh().catch(showError));
 document.body.dataset.deliveryReady='true';
})().catch(console.error);
