/* AYOUB XR — local image to 3D workflow. UI has no network or external requests. */
(()=>{
 'use strict';
 const d=window.document;const api=window.desktop||null;
 function el(tag,cls,text){const x=d.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x}
 function btn(text,cls,fn){const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;}
 const launch=btn('▧ صورة ← 3D','photo3d-launch',()=>openPanel());launch.id='photo3dLaunch';
 const actions=d.querySelector('.header-actions')||d.querySelector('header');actions?.prepend(launch);
 const backdrop=el('div','xr3d-modal');backdrop.id='xr3dModal';backdrop.hidden=true;
 backdrop.setAttribute('role','dialog');backdrop.setAttribute('aria-label','تحويل صورة إلى مجسم ثلاثي الأبعاد');backdrop.setAttribute('aria-modal','true');
 const shell=el('div','xr3d-shell');backdrop.append(shell);
 const header=el('div','xr3d-header');shell.append(header);
 const headerTitles=el('div');header.append(headerTitles);headerTitles.append(el('span','xr3d-eyebrow','AYOUB XR • 3D ASSET LAB'));headerTitles.append(el('h2',null,'من الصورة إلى مجسم 3D'));headerTitles.append(el('p',null,'توليد محلي، ثم حزمة تسليم متعددة الصيغ مع الملفات والمواد.'));
 header.append(btn('×','xr3d-close',closePanel));
 const body=el('div','xr3d-grid');shell.append(body);
 const left=el('section','xr3d-column');body.append(left);
 const right=el('section','xr3d-column');body.append(right);
 const card1=el('section','xr3d-card');left.append(card1);card1.append(el('h3',null,'01 — المصدر'));
 const nameLabel=el('label','xr3d-field','اسم القطعة أو التصميم');const title=el('input');title.type='text';title.value='New-3D-Asset';title.maxLength=70;nameLabel.append(title);card1.append(nameLabel);
 const imgSlot=el('label','xr3d-drop');imgSlot.setAttribute('for','xr3dFile');imgSlot.append(el('span','xr3d-drop-icon','▧'));imgSlot.append(el('strong',null,'اختر صورة PNG / JPG / WebP'));imgSlot.append(el('span',null,'صورة واضحة لجسم واحد وخلفية بسيطة أفضل'));card1.append(imgSlot);
 const imageInput=el('input');imageInput.type='file';imageInput.accept='image/png,image/jpeg,image/webp';imageInput.id='xr3dFile';imageInput.hidden=true;card1.append(imageInput);
 const photo=el('img','xr3d-preview');photo.alt='معاينة الصورة المراد تحويلها';photo.hidden=true;card1.append(photo);
 const sourceInfo=el('p','xr3d-minor','الأجزاء غير المرئية بالصورة سيقدّرها الذكاء الاصطناعي؛ لا تُعتبر أبعادًا تنفيذية.');card1.append(sourceInfo);
 const card2=el('section','xr3d-card');left.append(card2);card2.append(el('h3',null,'02 — محرك التوليد المحلي'));
 const modeLabel=el('label','xr3d-field','نوع التحويل');const mode=el('select');mode.id='xr3dMode';for(const [value,text] of [['object','جسم مستقل — مجسم تقديري'],['wall','جدار أو زخرفة — سطح بارز 2.5D']]){const o=el('option',null,text);o.value=value;mode.append(o)}modeLabel.append(mode);card2.append(modeLabel);
 const heightLabel=el('label','xr3d-field','ارتفاع الجدار المفترض بالمتر');const wallHeight=el('input');wallHeight.id='xr3dWallHeight';wallHeight.type='number';wallHeight.min='.5';wallHeight.max='8';wallHeight.step='.1';wallHeight.value='2.8';heightLabel.append(wallHeight);heightLabel.hidden=true;card2.append(heightLabel);
 const modeNote=el('p','xr3d-minor','مسودة توليد تحتاج فحص الشكل. المحرك الحالي لم يحقق جودة مقبولة في اختبار الكنبة.');card2.append(modeNote);
 mode.addEventListener('change',()=>{heightLabel.hidden=mode.value!=='wall';modeNote.textContent=mode.value==='wall'?'يستنتج بروزًا ضحلًا من تفاصيل الصورة. العمق والأبعاد تقديرية، وإضاءة الصورة تبقى ضمن اللون.':'مسودة توليد تحتاج فحص الشكل. المحرك الحالي لم يحقق جودة مقبولة في اختبار الكنبة.';primary.textContent=mode.value==='wall'?'إنشاء جدار بارز ومعاينته':'إنشاء مجسم تقديري ومعاينته';});
 const status=el('div','xr3d-status','جارٍ فحص المكونات...');card2.append(status);
 const setup=el('div','xr3d-actions');card2.append(setup);
 setup.append(btn('تهيئة المحرك تلقائيًا','xr3d-outline',async()=>{if(!api)return;await handle(async()=>{await api.photo3dSetup();write('✓ اكتمل إعداد المحرك.');await refresh();});}));
 setup.append(btn('إعادة فحص المكونات','xr3d-outline',()=>handle(()=>refresh(true))));
 const primary=btn('إنشاء مجسم + تجهيز جميع الصيغ','xr3d-primary',generate);primary.id='xr3dGenerate';card2.append(primary);
 card2.append(el('p','xr3d-minor','يكتشف Blender تلقائيًا. تُحفظ النتائج والسجل داخل مجلد results بجانب البرنامج. تهيئة المحرك تحتاج الإنترنت؛ التوليد بعدها محلي.'));
 const card3=el('section','xr3d-card');right.append(card3);card3.append(el('h3',null,'03 — حزمة ملفات العميل'));
 const formatGrid=el('div','xr3d-formats');card3.append(formatGrid);
 for(const [a,b] of [['GLB','العارض + Blender'],['FBX','3ds Max'],['DAE','SketchUp'],['OBJ + MTL','مع الخامات'],['glTF','ملفات منفصلة'],['USD','عبر أدوات USD'],['STL','هندسة فقط']]){
  const tag=el('div','xr3d-format');tag.append(el('strong',null,a));tag.append(el('small',null,b));formatGrid.append(tag);
 }
 const choose=btn('تصدير مجسم 3D موجود لعدة صيغ','xr3d-secondary',exportExisting);card3.append(choose);
 card3.append(el('p','xr3d-minor','تستطيع اختيار GLB أو OBJ أو FBX أو BLEND موجود. الصيغ التي لا يدعمها إصدار Blender ستُذكر صراحة في تقرير التسليم.'));
 const card4=el('section','xr3d-card');right.append(card4);card4.append(el('h3',null,'سجل المعالجة'));
 const log=el('pre','xr3d-log','لم يبدأ التوليد بعد.');card4.append(log);
 const links=el('div','xr3d-links');card4.append(links);
 const footer=el('div','xr3d-footer');shell.append(footer);footer.append(el('span',null,'ملفات العملاء محلية على جهازك. لا يتم نشر النماذج تلقائيًا.'));footer.append(el('span',null,'جودة الموديل تتأثر بالصورة ومواصفات GPU.'));
 d.body.append(backdrop);
 let file=null,busy=false,sourceUrl=null,ready=false;
 primary.disabled=true;
 imageInput.addEventListener('change',()=>{
  file=imageInput.files?.[0]||null;
  if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=null;photo.hidden=true;
  if(file){if(file.size>20*1024*1024){warn('حجم الصورة أكبر من 20 MB.');file=null;return;}
   sourceUrl=URL.createObjectURL(file);photo.src=sourceUrl;photo.hidden=false;imgSlot.querySelector('strong').textContent=file.name;}
 });
 function write(msg){const v=String(msg||'');log.textContent=(log.textContent+'\n'+v).slice(-5500);log.scrollTop=log.scrollHeight;}
 function warn(msg){write('⚠ '+msg);status.textContent=msg;status.classList.add('xr3d-error');if(api?.testMode)window.__photo3dError=msg;}
 function done(result){if(result.cancelled){write('ألغيت العملية قبل الحفظ.');return;}
  if(api?.testMode)window.__photo3dResult=result;
  write('✓ أنشئت الحزمة: '+result.zip);write('الصيغ: '+(result.outputs||[]).join(', '));
  for(const w of result.warnings||[])write('مراجعة: '+w);
  status.textContent='اكتملت المعالجة — جودة الشكل تحتاج مراجعة.';status.classList.remove('xr3d-error');links.replaceChildren();
  if(result.folder)links.append(btn('فتح مجلد النتائج','xr3d-outline',()=>api.photo3dOpenOutput({folder:result.folder})));
  if(result.preview)links.append(btn('معاينة المجسم والخامات','xr3d-primary',()=>handle(async()=>{const p=await api.photo3dPreview({source:result.preview});await window.ayoubImportGenerated(new File([p.bytes],p.name,{type:'model/gltf-binary'}));backdrop.hidden=true;d.body.style.overflow='';})));
 }
 async function handle(cb){if(busy)return;busy=true;primary.disabled=true;choose.disabled=true;
  try{return await cb()}catch(err){warn(err?.message||String(err));}
  finally{busy=false;primary.disabled=!ready;choose.disabled=false;}
 }
 function imageBase64(f){return new Promise((resolve,reject)=>{
  const r=new FileReader();r.onerror=()=>reject(Error('تعذرت قراءة الصورة.'));r.onload=()=>{const s=String(r.result);resolve(s.split(',')[1]||'')};r.readAsDataURL(f);
 });}
 async function generate(){if(!file){warn('اختر صورة للجسم أولًا.');return;}
  if(!ready){warn('المحرك غير جاهز. اضغط تهيئة المحرك أولًا.');return;}
  if(!api){warn('التوليد متاح في برنامج Windows، وليس من نسخة العرض الموجهة للعميل.');return;}
  await handle(async()=>{write('بدء توليد الصورة محليًا...');const base64=await imageBase64(file);
   done(await api.photo3dGenerate({mime:file.type,base64,title:title.value,mode:mode.value,wallHeight:Number(wallHeight.value)}));
  });
 }
 async function exportExisting(){if(!api){warn('التصدير متعدد الصيغ متاح داخل برنامج Windows.');return;}
  await handle(async()=>{const choice=await api.photo3dChooseModel();if(choice.cancelled)return;
   write('النموذج: '+choice.name);done(await api.photo3dExport({source:choice.source,title:title.value}));
  });
 }
 async function refresh(force=false){if(!api){status.textContent='افتح هذه الأداة من تطبيق Windows لإجراء التوليد والتصدير.';primary.disabled=true;choose.disabled=true;return;}
  try{const data=await api.photo3dStatus({force});ready=Boolean(data.ready);primary.disabled=busy||!ready;status.classList.remove('xr3d-error');status.textContent=(data.triposr?'✓ TripoSR جاهز':'○ المحرك يحتاج تهيئة')+'  •  '+(data.python?'✓ Python مستقل':'○ Python غير جاهز')+'  •  '+(data.blender?'✓ Blender مكتشف تلقائيًا':'○ Blender غير موجود')+(data.health?.gpu?'  •  '+data.health.gpu:'');if(!ready&&data.health?.errors?.length)write(data.health.errors.join('\n'));}
  catch(e){warn(e.message)}
 }
 function openPanel(){backdrop.hidden=false;d.body.style.overflow='hidden';refresh();title.focus();}
 function closePanel(){if(busy)return;backdrop.hidden=true;d.body.style.overflow='';}
 backdrop.addEventListener('click',e=>{if(e.target===backdrop)closePanel();});
 d.addEventListener('keydown',e=>{if(e.key==='Escape'&&!backdrop.hidden)closePanel();});
 api?.photo3dOnProgress?.(p=>{if(backdrop.hidden)return;const s=(p.stage||'')+': '+(p.message||'');write(s);});
})();
