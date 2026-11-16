/* AYOUB XR client white-label header: project name only. */
if(document.body.classList.contains('viewer-mode')){
  const brand=document.querySelector('.topbar .brand');
  const nameEl=brand?.querySelector('strong');
  const subtitle=brand?.querySelector('small');
  const mark=brand?.querySelector('.brandmark');
  if(mark)mark.hidden=true;if(subtitle)subtitle.hidden=true;
  const project=document.getElementById('projectTitle');
  function sync(){const title=(project?.textContent||'مشروع هندسي').trim();if(nameEl)nameEl.textContent=title;document.title=title;}
  sync();if(project)new MutationObserver(sync).observe(project,{childList:true,characterData:true,subtree:true});
  const version=document.querySelector('.topbar .version');if(version)version.hidden=true;
}
