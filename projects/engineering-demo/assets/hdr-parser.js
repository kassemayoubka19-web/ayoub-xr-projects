export function readRadiance(buffer){const b=new Uint8Array(buffer),decoder=new TextDecoder('ascii');let at=0,lines=[];
  function line(){const start=at;while(at<b.length&&b[at]!==10)at++;if(at>=b.length)throw Error('HDR: رأس غير مكتمل');const s=decoder.decode(b.subarray(start,at)).replace(/\r$/,'');at++;return s;}
  let l=line();if(!l.startsWith('#?'))throw Error('صيغة Radiance HDR غير صحيحة');for(let n=0;n<120;n++){l=line();if(!l)break;lines.push(l);}
  if(!lines.some(s=>s.includes('FORMAT=32-bit_rle_rgbe')))throw Error('HDR: يدعم 32-bit RLE RGBE فقط');
  const res=line().trim().match(/^-Y\s+(\d+)\s+\+X\s+(\d+)$/);if(!res)throw Error('HDR: ترتيب المحاور غير مدعوم');const h=Number(res[1]),w=Number(res[2]);if(w<8||w>4096||h<1||h>2048||w*h>6e6)throw Error('HDR: الدقة خارج الحدود المسموحة');
  const data=new Float32Array(w*h*4);const scan=new Uint8Array(w*4);
  for(let y=0;y<h;y++){
    if(at+4>b.length)throw Error('HDR: بيانات ناقصة');const a=b[at++],c=b[at++],hi=b[at++],lo=b[at++];
    if(a!==2||c!==2||((hi<<8)|lo)!==w)throw Error('HDR: مسارات RLE غير مدعومة');
    for(let ch=0;ch<4;ch++){let x=0;while(x<w){if(at>=b.length)throw Error('HDR: ملف مبتور');const len=b[at++];if(len>128){const qty=len-128;if(qty<1||x+qty>w||at>=b.length)throw Error('HDR: RLE غير صالح');scan.fill(b[at++],ch*w+x,ch*w+x+qty);x+=qty;}else{if(!len||x+len>w||at+len>b.length)throw Error('HDR: RLE غير صالح');scan.set(b.subarray(at,at+len),ch*w+x);at+=len;x+=len;}}}
    for(let x=0;x<w;x++){const E=scan[3*w+x],k=(y*w+x)*4,scale=E?Math.pow(2,E-128)/256:0;data[k]=scan[x]*scale;data[k+1]=scan[w+x]*scale;data[k+2]=scan[2*w+x]*scale;data[k+3]=1;}
  }
  return {width:w,height:h,data};
}
