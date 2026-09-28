const hex=(c)=>{c=c.replace("#","");if(c.length===3)c=c.split("").map(x=>x+x).join("");return[0,2,4].map(i=>parseInt(c.slice(i,i+2),16));};
const toHex=(r)=>"#"+r.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("");
const mix=(a,b,t)=>{const A=hex(a),B=hex(b);return toHex(A.map((v,i)=>v+(B[i]-v)*t));};
const lum=(c)=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};const[r,g,b]=hex(c).map(f);return 0.2126*r+0.7152*g+0.0722*b;};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
const readable=(fg,bg,min)=>{let c=fg,i=0;const toward=lum(bg)>0.4?"#000000":"#ffffff";while(contrast(c,bg)<min&&i<20){c=mix(c,toward,0.08);i++;}return c;};

const KEYS=[
  {key:"bg",label:"Background",hint:"Window and detail pane"},
  {key:"s2",label:"Sidebar",hint:"Sidebar and list ground"},
  {key:"s3",label:"Surface",hint:"Cards, menus, dialogs"},
  {key:"s4",label:"Fill",hint:"Hover, tags, tiles"},
  {key:"b1",label:"Border",hint:"Hairlines and dividers"},
  {key:"t1",label:"Text",hint:"Titles and body"},
  {key:"t2",label:"Secondary text",hint:"Labels and metadata"},
  {key:"accent",label:"Accent",hint:"Focus, links, selection"},
  {key:"accent2",label:"Accent 2",hint:"Charts and highlights"}
];

const PRESETS=[
  {id:"dark",name:"Dark",desc:"APM default. Near-black, ink-first.",base:"dark",c:{bg:"#09090b",s2:"#0e0e11",s3:"#131316",s4:"#1b1b1f",b1:"#1f1f24",t1:"#ededf0",t2:"#a1a1ab",accent:"#5b8dff",accent2:"#3ecf8e"},native:true},
  {id:"light",name:"Light",desc:"APM default. White paper, ink type.",base:"light",c:{bg:"#ffffff",s2:"#f9f9fa",s3:"#ffffff",s4:"#f1f1f4",b1:"#e7e7eb",t1:"#111113",t2:"#5b5b65",accent:"#1d5cf5",accent2:"#157347"},native:true},
  {id:"midnight",name:"Midnight",desc:"True black with a systemGray ramp.",base:"dark",c:{bg:"#000000",s2:"#0c0c0e",s3:"#161618",s4:"#1f1f22",b1:"#232326",t1:"#f5f5f7",t2:"#a1a1a6",accent:"#0a84ff",accent2:"#30d158"}},
  {id:"graphite",name:"Graphite",desc:"Cool slate grays, quiet violet accent.",base:"dark",c:{bg:"#0f1115",s2:"#13151a",s3:"#181b21",s4:"#20232b",b1:"#252932",t1:"#e6e8ee",t2:"#9ba2af",accent:"#8b93ff",accent2:"#5eead4"}},
  {id:"nord",name:"Nord",desc:"Arctic polar night, frosted blue.",base:"dark",c:{bg:"#2e3440",s2:"#2a2f3a",s3:"#3b4252",s4:"#434c5e",b1:"#3b4252",t1:"#eceff4",t2:"#b7bfcc",accent:"#88c0d0",accent2:"#a3be8c"}},
  {id:"catppuccin",name:"Catppuccin",desc:"Mocha pastels on a soft base.",base:"dark",c:{bg:"#1e1e2e",s2:"#181825",s3:"#24243a",s4:"#313244",b1:"#313244",t1:"#cdd6f4",t2:"#a6adc8",accent:"#cba6f7",accent2:"#a6e3a1"}},
  {id:"tokyo",name:"Tokyo Night",desc:"Storm-blue depths, neon glow.",base:"dark",c:{bg:"#1a1b26",s2:"#16161e",s3:"#1f2335",s4:"#292e42",b1:"#292e42",t1:"#c0caf5",t2:"#a9b1d6",accent:"#7aa2f7",accent2:"#9ece6a"}},
  {id:"rosepine",name:"Rosé Pine",desc:"Rose, gold and pine on deep violet.",base:"dark",c:{bg:"#191724",s2:"#16141f",s3:"#1f1d2e",s4:"#26233a",b1:"#26233a",t1:"#e0def4",t2:"#a8a4c0",accent:"#ebbcba",accent2:"#9ccfd8"}},
  {id:"dracula",name:"Dracula",desc:"Bold gothic contrast.",base:"dark",c:{bg:"#282a36",s2:"#21222c",s3:"#2d2f3d",s4:"#383a4a",b1:"#343746",t1:"#f8f8f2",t2:"#b9bccf",accent:"#bd93f9",accent2:"#50fa7b"}},
  {id:"gruvbox",name:"Gruvbox",desc:"Warm retro ink on aged paper.",base:"dark",c:{bg:"#282828",s2:"#1d2021",s3:"#32302f",s4:"#3c3836",b1:"#3c3836",t1:"#ebdbb2",t2:"#bdae93",accent:"#fabd2f",accent2:"#b8bb26"}},
  {id:"paper",name:"Paper",desc:"Crisp cool light, like a code review.",base:"light",c:{bg:"#ffffff",s2:"#f6f8fa",s3:"#ffffff",s4:"#eef1f4",b1:"#d8dee4",t1:"#1f2328",t2:"#59636e",accent:"#0969da",accent2:"#1a7f37"}},
  {id:"cream",name:"Cream",desc:"Warm stationery light.",base:"light",c:{bg:"#fbf8f1",s2:"#f4efe4",s3:"#fffdf8",s4:"#ece5d6",b1:"#e2d9c6",t1:"#2b2620",t2:"#6b6154",accent:"#a0522d",accent2:"#3f6e5e"}}
];

const STATUS={
  dark:{success:"#3ecf8e",warning:"#f2b441",danger:"#ff6b78"},
  light:{success:"#157347",warning:"#955500",danger:"#cc2338"}
};

function tokensFor(t){
  const c=t.c;
  const dark=lum(c.bg)<0.4;
  const st=STATUS[dark?"dark":"light"];
  const text=c.t1;
  const sec=readable(c.t2,c.s4,4.5);
  const ter=readable(mix(c.t2,c.bg,0.18),c.s4,4.5);
  const accent=readable(c.accent,c.s3,4.5);
  const v={
    "--bg":c.bg,"--bg-subtle":c.s2,"--surface":c.s3,
    "--fill":c.s4,"--fill-hover":mix(c.s4,text,dark?0.05:0.035),"--fill-active":mix(c.s4,text,dark?0.1:0.07),
    "--border":c.b1,"--border-strong":mix(c.b1,text,dark?0.1:0.12),"--border-hover":mix(c.b1,text,dark?0.2:0.24),
    "--text":text,"--text-secondary":sec,"--text-tertiary":ter,"--text-disabled":mix(c.t2,c.bg,0.55),
    "--primary":text,"--primary-hover":mix(text,c.bg,0.14),"--on-primary":c.bg,
    "--accent":accent,"--accent-hover":mix(accent,text,0.2),"--accent-soft":mix(c.accent,c.bg,dark?0.84:0.9),"--on-accent":contrast("#ffffff",accent)>=4.5?"#ffffff":c.bg,
    "--success":readable(st.success,c.s3,4.5),"--success-soft":mix(st.success,c.bg,dark?0.84:0.9),
    "--warning":readable(st.warning,c.s3,4.5),"--warning-soft":mix(st.warning,c.bg,dark?0.86:0.88),
    "--danger":readable(st.danger,c.s3,4.5),"--danger-soft":mix(st.danger,c.bg,dark?0.84:0.9),
    "--on-danger":dark?c.bg:"#ffffff",
    "--accent-2":c.accent2
  };
  return{vars:v,base:dark?"dark":"light"};
}

function applyTheme(theme,systemDark){
  const root=document.documentElement;
  const t=theme&&theme.id==="system"?PRESETS[systemDark?0:1]:theme||PRESETS[0];
  root.setAttribute("data-theme",t.base||"dark");
  const names=["--bg","--bg-subtle","--surface","--fill","--fill-hover","--fill-active","--border","--border-strong","--border-hover","--text","--text-secondary","--text-tertiary","--text-disabled","--primary","--primary-hover","--on-primary","--accent","--accent-hover","--accent-soft","--on-accent","--success","--success-soft","--warning","--warning-soft","--danger","--danger-soft","--on-danger","--accent-2"];
  names.forEach(n=>root.style.removeProperty(n));
  if(t.native)return t.base;
  const {vars,base}=tokensFor(t);
  root.setAttribute("data-theme",base);
  Object.entries(vars).forEach(([k,val])=>root.style.setProperty(k,val));
  return base;
}

export {KEYS,PRESETS,tokensFor,applyTheme,mix,contrast,lum,readable};
