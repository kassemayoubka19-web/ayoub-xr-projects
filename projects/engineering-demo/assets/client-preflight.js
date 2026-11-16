/* Progressive preflight: static published scene compatibility notice.
   No remote requests or telemetry. */
(function () {
  let shown = false;
  function notice(title, detail) {
    if (shown) return;
    shown = true;
    const overlay = document.createElement('div');
    overlay.id = 'clientWebGLWarning';
    overlay.setAttribute('role', 'alert');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#102033;color:#f2faff;display:grid;place-items:center;font:15px/1.9 system-ui,Tahoma,Arial;direction:rtl;padding:18px';
    const panel = document.createElement('div');
    panel.style.cssText = 'max-width:490px;border:1px solid #52758d;background:#1a3449;border-radius:14px;padding:25px;text-align:right';
    const heading = document.createElement('h2');heading.textContent = title;
    const message = document.createElement('p');message.textContent = detail;
    panel.append(heading,message);overlay.append(panel);document.body.append(overlay);
  }
  function supported(){
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', {powerPreference:'low-power', antialias:false});
      const ok = Boolean(gl);
      if(gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
      return ok;
    }catch{return false;}
  }
  if(!supported()) {
    const run=()=>notice('تعذر تشغيل المشهد ثلاثي الأبعاد', 'يحتاج هذا المشروع متصفحًا حديثًا مع WebGL2 وتسريع الرسوميات. جرّب Chrome أو Edge أو Safari محدثًا، وأوقف وضع توفير الطاقة إذا عطّل الرسوميات.');
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  }
  window.addEventListener('error', function (e) {
    if (/webgl|context|gpu/i.test(String(e.message||''))) notice('مشكلة في تشغيل الرسوميات','تعذر تهيئة محرك العرض على هذا الجهاز. حدّث المتصفح أو جرّب جهازًا آخر.');
  });
})();
