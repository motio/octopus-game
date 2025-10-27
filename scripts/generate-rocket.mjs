#!/usr/bin/env node
/**
 * 120x120 のシンプルなロケットPNG生成
 * 出力: public/assets/rocket.png
 * 形状: ノーズコーン(赤) + 胴体(白グレー) + サイドフィン(赤) + 窓(青) + 炎
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { PNG } from 'pngjs';

const SIZE = 120;
const OUTPUT = 'public/assets/rocket.png';

function clamp(v){return v<0?0:v>255?255:v;}
function idx(x,y){return (y*SIZE+x)<<2;}
function setPixel(png,x,y,r,g,b,a=255){if(x<0||y<0||x>=SIZE||y>=SIZE)return;const i=idx(x,y);png.data[i]=r;png.data[i+1]=g;png.data[i+2]=b;png.data[i+3]=a;}

function drawEllipse(png,cx,cy,rx,ry,color){for(let y=-ry;y<=ry;y++){for(let x=-rx;x<=rx;x++){if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1){setPixel(png,cx+x,cy+y,color.r,color.g,color.b,255);}}}}

function drawBody(png){
  // 胴体（縦長楕円）
  const bodyColor={r:230,g:235,b:240};
  drawEllipse(png,SIZE/2,SIZE/2+10,26,40,bodyColor);
  // ノーズコーン（上半分を赤で上書き）
  for(let y=0;y<SIZE/2+10;y++){
    for(let x=0;x<SIZE;x++){
      const i=idx(x,y);
      // 胴体のピクセルか判定(アルファ==255で近辺範囲絞り)
      if(png.data[i+3]===255){
        if(y < SIZE/2 - 10){ // 上部領域を赤に
          png.data[i]=200; png.data[i+1]=40; png.data[i+2]=60;
        }
      }
    }
  }
  // 下部にグラデーション影
  for(let y=SIZE/2+10;y<SIZE;y++){
    for(let x=0;x<SIZE;x++){
      const i=idx(x,y);
      if(png.data[i+3]===255){
        const shade = 1 + (y - (SIZE/2+10))/(SIZE/2);
        png.data[i]=clamp(png.data[i]-20*shade);
        png.data[i+1]=clamp(png.data[i+1]-20*shade);
        png.data[i+2]=clamp(png.data[i+2]-25*shade);
      }
    }
  }
}

function drawFins(png){
  // サイドフィン (左右三角)
  const finColor={r:210,g:50,b:70};
  const cy = SIZE/2+30;
  const left=[[SIZE/2-10,cy-10],[SIZE/2-45,cy+15],[SIZE/2-10,cy+20]];
  const right=[[SIZE/2+10,cy-10],[SIZE/2+45,cy+15],[SIZE/2+10,cy+20]];
  fillPoly(png,left,finColor);
  fillPoly(png,right,finColor);
}

function fillPoly(png,pts,color){
  const minY=Math.max(0,Math.min(...pts.map(p=>p[1])));
  const maxY=Math.min(SIZE-1,Math.max(...pts.map(p=>p[1])));
  for(let y=minY;y<=maxY;y++){
    const inter=[];
    for(let i=0;i<pts.length;i++){
      const a=pts[i], b=pts[(i+1)%pts.length];
      if((y>=a[1]&&y<b[1]) || (y>=b[1]&&y<a[1])){
        const t=(y-a[1])/(b[1]-a[1]);
        inter.push(a[0]+(b[0]-a[0])*t);
      }
    }
    inter.sort((a,b)=>a-b);
    for(let k=0;k<inter.length;k+=2){
      const xs=Math.round(inter[k]);
      const xe=Math.round(inter[k+1]);
      for(let x=xs;x<=xe;x++){
        setPixel(png,x,y,color.r,color.g,color.b,255);
      }
    }
  }
}

function drawWindow(png){
  // 丸窓
  const wColor={r:120,g:170,b:255};
  const cx=SIZE/2, cy=SIZE/2; const r=12;
  for(let y=-r;y<=r;y++){
    for(let x=-r;x<=r;x++){
      if(x*x+y*y<=r*r){
        // ガラス調
        const i=idx(cx+x,cy+y);
        setPixel(png,cx+x,cy+y,wColor.r,wColor.g,wColor.b,255);
      }
    }
  }
  // ハイライト
  for(let y=-r; y<0; y++){
    for(let x=-r; x<0; x++){
      if(x*x+y*y<=r*r){
        const i=idx(cx+x,cy+y);
        if(i>=0){
          // 淡く白混ぜ
          const alpha=0.25;
          png.data[i]=clamp(png.data[i]*(1-alpha)+255*alpha);
          png.data[i+1]=clamp(png.data[i+1]*(1-alpha)+255*alpha);
          png.data[i+2]=clamp(png.data[i+2]*(1-alpha)+255*alpha);
        }
      }
    }
  }
}

function drawFlame(png){
  // 炎 (下部中央に放射グラデーション)
  const cx=SIZE/2, cy=SIZE/2+50;
  for(let y=cy; y<SIZE; y++){
    for(let x=cx-25; x<=cx+25; x++){
      const dx=x-cx, dy=y-cy;
      const dist=Math.sqrt(dx*dx+dy*dy);
      const maxR=35;
      if(dist<=maxR){
        const t=dist/maxR;
        const r= clamp(255);
        const g= clamp( Math.round(200*(1-t) + 50*t) );
        const b= clamp( Math.round(40*(1-t) + 10*t) );
        const i=idx(x,y);
        // 既存ピクセルより下なら重ね塗り
        setPixel(png,x,y,r,g,b,220);
      }
    }
  }
}

function main(){
  console.log('Generating rocket PNG...');
  const png=new PNG({width:SIZE,height:SIZE});
  drawBody(png);
  drawFins(png);
  drawWindow(png);
  drawFlame(png);
  if(!existsSync('public/assets')) mkdirSync('public/assets',{recursive:true});
  const buffer=PNG.sync.write(png);
  writeFileSync(OUTPUT,buffer);
  console.log('Rocket generated:', OUTPUT);
}

main();
