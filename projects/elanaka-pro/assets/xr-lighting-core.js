// AYOUB XR - immutable, validated photometric/lighting configuration.
// Deliberately independent of Three.js so schema and LM-63 tests can run in Node.
export const MAX_LIGHT_ASSET_BYTES = 24 * 1024 * 1024;
export const LIGHTING_MODES = Object.freeze(['neutral', 'exterior', 'interior', 'evening']);
const num = (n,low,high,defaultValue) => Number.isFinite(Number(n)) ? Math.max(low,Math.min(high,Number(n))) : defaultValue;
const vec = (v,defaults) => Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<100000)
  ? v.slice():defaults.slice();
const col = (s,def='#ffffff') => typeof s==='string'&&/^#[a-f\d]{6}$/i.test(s)?s:def;
export function sanitizeLighting(data={}) {
 const s=data&&typeof data==='object'&&!Array.isArray(data)?data:{};
 return {
  version:1,
  mode:LIGHTING_MODES.includes(s.mode)?s.mode:'neutral',
  exposure:num(s.exposure,.25,3,1),
  environmentIntensity:num(s.environmentIntensity,0,3,.85),
  background:Boolean(s.background),
  ambientIntensity:num(s.ambientIntensity,0,3,.65),
  shadows:s.shadows!==false,
  hdri:s.hdri==='lighting/environment.hdr'||s.hdri==='lighting/environment.exr'?s.hdri:null,
  fixtures:Array.isArray(s.fixtures)?s.fixtures.slice(0,20).filter(x=>x&&typeof x==='object').map((x,i)=>({
    name:typeof x.name==='string'?x.name.slice(0,70):'IES '+(i+1),
    position:vec(x.position,[0,3,0]),target:vec(x.target,[0,0,0]),
    color:col(x.color,'#fff2de'),intensity:num(x.intensity,0,2000,80),
    angle:num(x.angle,5,89,55),distance:num(x.distance,.1,150,15),
    ies:typeof x.ies==='string'&&/^lighting\/fixture\d{1,2}\.ies$/.test(x.ies)?x.ies:null
  })):[]
 };
}
// IESNA LM-63 basic TILT=NONE photometric Type C. Reject unsupported variants rather than silently use wrong curves.
export function parseIES(text) {
 if(typeof text!=='string'||text.length>8*1024*1024)throw Error('IES: invalid file');
 const tiltMatch=text.match(/(?:^|\r?\n)\s*TILT\s*=\s*([^\r\n]+)/i);
 if(!tiltMatch)throw Error('IES: missing TILT');
 if(tiltMatch[1].trim().toUpperCase()!=='NONE')throw Error('IES: external/embedded TILT tables not supported');
 const s=text.slice(tiltMatch.index+tiltMatch[0].length).replace(/,/g,' ').trim();
 const a=(s.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)||[]).map(Number);
 if(a.length<13)throw Error('IES: incomplete LM-63 photometric header');
 const nV=a[3],nH=a[4],ptype=a[5];
 if(!Number.isInteger(nV)||nV<2||nV>500||!Number.isInteger(nH)||nH<1||nH>500)throw Error('IES: unsupported angle count');
 if(ptype!==1)throw Error('IES: only photometric type C is supported');
 const needed=13+nV+nH+nV*nH;
 if(a.length<needed)throw Error('IES: candela array incomplete');
 const vertical=a.slice(13,13+nV),horizontal=a.slice(13+nV,13+nV+nH),
  candela=a.slice(13+nV+nH,needed),multiplier=a[2];
 if(!Number.isFinite(multiplier)||multiplier<=0||!candela.every(v=>Number.isFinite(v)&&v>=0))throw Error('IES: invalid candela values');
 for(const x of [vertical,horizontal])for(let i=1;i<x.length;i++)if(x[i]<=x[i-1])throw Error('IES: nonmonotonic angles');
 if(vertical[0]<0||vertical.at(-1)>180||horizontal[0]<0||horizontal.at(-1)>360)throw Error('IES: unsupported angular range');
 const maxCandela=Math.max(...candela)*multiplier;
 if(maxCandela<=0)throw Error('IES: zero luminous output');
 return {version:1,vertical,horizontal,candela,multiplier,maxCandela};
}
const inter=(angles,d)=> {
 if(angles.length===1)return [0,0,0];
 if(d<=angles[0])return [0,0,0];
 for(let i=1;i<angles.length;i++)if(d<=angles[i]){
  const t=(d-angles[i-1])/(angles[i]-angles[i-1]);return [i-1,i,t];
 }
 return [angles.length-1,angles.length-1,0];
};
export function sampleIES(p,verticalAngle,horizontalAngle=0) {
 const va=inter(p.vertical,Math.max(0,Math.min(180,verticalAngle)));
 let h=((horizontalAngle%360)+360)%360;
 // Symmetrical profiles have one horizontal measurement; for the 0..90, 0..180 axes use quadrant/mirror symmetry.
 const last=p.horizontal.at(-1);
 if(last===0)h=0;
 else if(last===90)h=Math.min(h%180,180-(h%180));
 else if(last===180)h=Math.min(h,360-h);
 const ha=inter(p.horizontal,h),n=p.vertical.length;
 const c=(ix,iy)=>p.candela[ix*n+iy];
 const lerp=(a,b,t)=>a+(b-a)*t;
 return lerp(lerp(c(ha[0],va[0]),c(ha[0],va[1]),va[2]),
             lerp(c(ha[1],va[0]),c(ha[1],va[1]),va[2]),ha[2])*p.multiplier;
}
export function iesCookieData(p,angleDeg=55,size=128) {
 if(!Number.isInteger(size)||size<16||size>1024)throw Error('Invalid cookie resolution');
 const out=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,r=Math.hypot(u,v),i=(y*size+x)*4;
  const polar=Math.atan(r*Math.tan(angleDeg*Math.PI/180))*180/Math.PI;
  const azimuth=(Math.atan2(v,u)*180/Math.PI+360)%360;
  const normalized=r>1?0:sampleIES(p,polar,azimuth)/p.maxCandela;
  const b=Math.round(Math.max(0,Math.min(1,normalized))*255);
  out[i]=out[i+1]=out[i+2]=b;out[i+3]=255;
 }
 return out;
}
export function validateLightingAsset(path,bytes){
 if(!['lighting/environment.hdr','lighting/environment.exr'].includes(path)&&!/^lighting\/fixture\d{1,2}\.ies$/.test(path))throw Error('Unsafe lighting asset path');
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_LIGHT_ASSET_BYTES)throw Error('Lighting asset exceeds size or is empty');
 if(path.endsWith('.hdr')&&!new TextDecoder().decode(bytes.slice(0,28)).includes('#?'))throw Error('Invalid Radiance HDR header');
 if(path.endsWith('.exr')&&!(bytes[0]===0x76&&bytes[1]===0x2f&&bytes[2]===0x31&&bytes[3]===0x01))throw Error('Invalid OpenEXR header');
 if(path.endsWith('.ies'))parseIES(new TextDecoder().decode(bytes));
 return true;
}
